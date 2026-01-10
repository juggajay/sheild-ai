import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'
import { createNotificationForProjectTeam } from '@/lib/notifications'
import { performSimulatedFraudAnalysis, type FraudAnalysisResult } from '@/lib/fraud-detection'
import { uploadFile, getStorageInfo } from '@/lib/storage'
import { extractDocumentData, convertToLegacyFormat, shouldSkipFraudDetection } from '@/lib/gemini'

interface InsuranceRequirement {
  coverageType: string
  minimumLimit: number | null
  limitType?: string | null
  maximumExcess: number | null
  principalIndemnityRequired: boolean
  crossLiabilityRequired: boolean
  waiverOfSubrogationRequired?: boolean
  principalNamingRequired?: string | null
}

// List of APRA-licensed general insurers in Australia
const APRA_LICENSED_INSURERS = [
  'QBE Insurance (Australia) Limited',
  'Allianz Australia Insurance Limited',
  'Suncorp Group Limited',
  'CGU Insurance Limited',
  'Zurich Australian Insurance Limited',
  'AIG Australia Limited',
  'Vero Insurance',
  'GIO General Limited',
  'Insurance Australia Limited',
  'AAI Limited',
  'Chubb Insurance Australia Limited',
  'HDI Global Specialty SE - Australia',
  'Liberty Mutual Insurance Company',
  'Tokio Marine & Nichido Fire Insurance Co., Ltd',
  'XL Insurance Company SE',
  'AXA Corporate Solutions Assurance',
  'Swiss Re International SE',
  'Munich Holdings of Australasia Pty Limited'
]

function formatCoverageType(type: string): string {
  const names: Record<string, string> = {
    public_liability: 'Public Liability',
    products_liability: 'Products Liability',
    workers_comp: "Workers' Compensation",
    professional_indemnity: 'Professional Indemnity',
    motor_vehicle: 'Motor Vehicle',
    contract_works: 'Contract Works'
  }
  return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Type for extracted data from Gemini (legacy format)
interface ExtractedData {
  insured_party_name: string
  insured_party_abn: string
  insured_party_address: string
  insurer_name: string
  insurer_abn: string
  policy_number: string
  period_of_insurance_start: string
  period_of_insurance_end: string
  coverages: Array<{
    type: string
    limit: number
    limit_type: string
    excess: number
    principal_indemnity?: boolean
    cross_liability?: boolean
    waiver_of_subrogation?: boolean
    principal_naming_type?: string | null
    state?: string
    employer_indemnity?: boolean
    retroactive_date?: string
  }>
  broker_name: string
  broker_contact: string
  broker_phone: string
  broker_email: string
  currency: string
  territory: string
  extraction_timestamp: string
  extraction_model: string
  extraction_confidence: number
  field_confidences: Record<string, number>
}

function verifyAgainstRequirements(
  extractedData: ExtractedData,
  requirements: InsuranceRequirement[],
  projectEndDate?: number | null,
  projectState?: string | null,
  subcontractorAbn?: string | null
) {
  const checks: Array<{
    check_type: string
    description: string
    status: 'pass' | 'fail' | 'warning'
    details: string
  }> = []

  const deficiencies: Array<{
    type: string
    severity: 'critical' | 'major' | 'minor'
    description: string
    required_value: string | null
    actual_value: string | null
  }> = []

  // Check policy dates
  const now = new Date()
  const policyEnd = new Date(extractedData.period_of_insurance_end)
  const daysUntilExpiry = Math.ceil((policyEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (policyEnd < now) {
    checks.push({
      check_type: 'policy_validity',
      description: 'Policy validity period',
      status: 'fail',
      details: 'Policy has expired'
    })
    deficiencies.push({
      type: 'expired_policy',
      severity: 'critical',
      description: 'Certificate of Currency has expired',
      required_value: 'Valid policy',
      actual_value: `Expired on ${extractedData.period_of_insurance_end}`
    })
  } else if (daysUntilExpiry <= 30) {
    const expiryText = daysUntilExpiry === 0 ? 'Policy expires today' :
                       daysUntilExpiry === 1 ? 'Policy expires in 1 day' :
                       `Policy expires in ${daysUntilExpiry} days`
    checks.push({
      check_type: 'policy_validity',
      description: 'Policy validity period',
      status: 'warning',
      details: expiryText
    })
  } else {
    checks.push({
      check_type: 'policy_validity',
      description: 'Policy validity period',
      status: 'pass',
      details: `Policy valid until ${extractedData.period_of_insurance_end}`
    })
  }

  // Check policy covers project period (if project has end date)
  if (projectEndDate) {
    const projectEnd = new Date(projectEndDate)
    if (policyEnd < projectEnd) {
      const projectEndDateStr = projectEnd.toISOString().split('T')[0]
      checks.push({
        check_type: 'project_coverage',
        description: 'Project period coverage',
        status: 'fail',
        details: `Policy expires before project end date (${projectEndDateStr})`
      })
      deficiencies.push({
        type: 'policy_expires_before_project',
        severity: 'critical',
        description: 'Policy expires before project completion date',
        required_value: `Valid until ${projectEndDateStr}`,
        actual_value: `Expires ${extractedData.period_of_insurance_end}`
      })
    } else {
      const projectEndDateStr = projectEnd.toISOString().split('T')[0]
      checks.push({
        check_type: 'project_coverage',
        description: 'Project period coverage',
        status: 'pass',
        details: `Policy covers project period (ends ${projectEndDateStr})`
      })
    }
  }

  // Check ABN matches
  if (subcontractorAbn) {
    const extractedAbn = extractedData.insured_party_abn?.replace(/\s/g, '') || ''
    const expectedAbn = subcontractorAbn.replace(/\s/g, '')

    if (extractedAbn !== expectedAbn) {
      checks.push({
        check_type: 'abn_verification',
        description: 'ABN verification',
        status: 'fail',
        details: `ABN ${extractedAbn} does not match subcontractor ABN ${expectedAbn}`
      })
      deficiencies.push({
        type: 'abn_mismatch',
        severity: 'critical',
        description: 'Certificate ABN does not match subcontractor ABN',
        required_value: expectedAbn,
        actual_value: extractedAbn
      })
    } else {
      checks.push({
        check_type: 'abn_verification',
        description: 'ABN verification',
        status: 'pass',
        details: `ABN ${extractedAbn} matches subcontractor record`
      })
    }
  } else {
    checks.push({
      check_type: 'abn_verification',
      description: 'ABN verification',
      status: 'pass',
      details: `ABN ${extractedData.insured_party_abn} verified`
    })
  }

  // Check if insurer is APRA-licensed
  const insurerName = extractedData.insurer_name
  const isApraLicensed = APRA_LICENSED_INSURERS.some(
    apraInsurer => apraInsurer.toLowerCase() === insurerName?.toLowerCase()
  )

  if (!isApraLicensed) {
    checks.push({
      check_type: 'apra_insurer_validation',
      description: 'APRA insurer validation',
      status: 'fail',
      details: `Insurer "${insurerName}" is not on the APRA-licensed insurers register`
    })
    deficiencies.push({
      type: 'unlicensed_insurer',
      severity: 'critical',
      description: 'Insurer is not APRA-licensed in Australia',
      required_value: 'APRA-licensed insurer',
      actual_value: insurerName || 'Unknown'
    })
  } else {
    checks.push({
      check_type: 'apra_insurer_validation',
      description: 'APRA insurer validation',
      status: 'pass',
      details: `Insurer "${insurerName}" is APRA-licensed`
    })
  }

  // Check each coverage type against requirements
  for (const requirement of requirements) {
    const coverage = extractedData.coverages.find(c => c.type === requirement.coverageType)

    if (!coverage) {
      checks.push({
        check_type: `coverage_${requirement.coverageType}`,
        description: `${formatCoverageType(requirement.coverageType)} coverage`,
        status: 'fail',
        details: 'Coverage not found in certificate'
      })
      deficiencies.push({
        type: 'missing_coverage',
        severity: 'critical',
        description: `${formatCoverageType(requirement.coverageType)} coverage is required but not present`,
        required_value: requirement.minimumLimit ? `$${requirement.minimumLimit.toLocaleString()}` : 'Required',
        actual_value: 'Not found'
      })
      continue
    }

    // Check minimum limit
    if (requirement.minimumLimit && coverage.limit < requirement.minimumLimit) {
      checks.push({
        check_type: `coverage_${requirement.coverageType}`,
        description: `${formatCoverageType(requirement.coverageType)} limit`,
        status: 'fail',
        details: `Limit $${coverage.limit.toLocaleString()} is below required $${requirement.minimumLimit.toLocaleString()}`
      })
      deficiencies.push({
        type: 'insufficient_limit',
        severity: 'major',
        description: `${formatCoverageType(requirement.coverageType)} limit is below minimum requirement`,
        required_value: `$${requirement.minimumLimit.toLocaleString()}`,
        actual_value: `$${coverage.limit.toLocaleString()}`
      })
    } else {
      checks.push({
        check_type: `coverage_${requirement.coverageType}`,
        description: `${formatCoverageType(requirement.coverageType)} limit`,
        status: 'pass',
        details: `Limit $${coverage.limit.toLocaleString()} meets minimum requirement`
      })
    }

    // Check maximum excess
    if (requirement.maximumExcess && coverage.excess > requirement.maximumExcess) {
      checks.push({
        check_type: `excess_${requirement.coverageType}`,
        description: `${formatCoverageType(requirement.coverageType)} excess`,
        status: 'fail',
        details: `Excess $${coverage.excess.toLocaleString()} exceeds maximum $${requirement.maximumExcess.toLocaleString()}`
      })
      deficiencies.push({
        type: 'excess_too_high',
        severity: 'minor',
        description: `${formatCoverageType(requirement.coverageType)} excess exceeds maximum allowed`,
        required_value: `Max $${requirement.maximumExcess.toLocaleString()}`,
        actual_value: `$${coverage.excess.toLocaleString()}`
      })
    }

    // Check principal indemnity
    if (requirement.principalIndemnityRequired && 'principal_indemnity' in coverage && !coverage.principal_indemnity) {
      checks.push({
        check_type: `principal_indemnity_${requirement.coverageType}`,
        description: `${formatCoverageType(requirement.coverageType)} principal indemnity`,
        status: 'fail',
        details: 'Principal indemnity extension required but not present'
      })
      deficiencies.push({
        type: 'missing_endorsement',
        severity: 'major',
        description: `Principal indemnity extension required for ${formatCoverageType(requirement.coverageType)}`,
        required_value: 'Yes',
        actual_value: 'No'
      })
    }

    // Check cross liability
    if (requirement.crossLiabilityRequired && 'cross_liability' in coverage && !coverage.cross_liability) {
      checks.push({
        check_type: `cross_liability_${requirement.coverageType}`,
        description: `${formatCoverageType(requirement.coverageType)} cross liability`,
        status: 'fail',
        details: 'Cross liability extension required but not present'
      })
      deficiencies.push({
        type: 'missing_endorsement',
        severity: 'major',
        description: `Cross liability extension required for ${formatCoverageType(requirement.coverageType)}`,
        required_value: 'Yes',
        actual_value: 'No'
      })
    }

    // Check Workers Comp state matches project state
    if (requirement.coverageType === 'workers_comp' && projectState && 'state' in coverage) {
      const wcState = (coverage as { state?: string }).state
      if (wcState && wcState !== projectState) {
        checks.push({
          check_type: 'workers_comp_state',
          description: "Workers' Compensation state coverage",
          status: 'fail',
          details: `WC scheme is for ${wcState} but project is in ${projectState}`
        })
        deficiencies.push({
          type: 'state_mismatch',
          severity: 'critical',
          description: `Workers' Compensation scheme does not cover project state`,
          required_value: `${projectState} scheme`,
          actual_value: `${wcState} scheme`
        })
      } else if (wcState && wcState === projectState) {
        checks.push({
          check_type: 'workers_comp_state',
          description: "Workers' Compensation state coverage",
          status: 'pass',
          details: `WC scheme (${wcState}) matches project state`
        })
      }
    }
  }

  // Calculate overall status
  const hasFailures = checks.some(c => c.status === 'fail')
  const hasWarnings = checks.some(c => c.status === 'warning')
  const hasCriticalDeficiencies = deficiencies.some(d => d.severity === 'critical')
  const confidenceScore = extractedData.extraction_confidence
  const LOW_CONFIDENCE_THRESHOLD = 0.70

  let overallStatus: 'pass' | 'fail' | 'review' = 'pass'
  if (hasFailures || hasCriticalDeficiencies) {
    overallStatus = 'fail'
  } else if (hasWarnings || confidenceScore < LOW_CONFIDENCE_THRESHOLD) {
    overallStatus = 'review'
    if (confidenceScore < LOW_CONFIDENCE_THRESHOLD) {
      checks.push({
        check_type: 'confidence_check',
        description: 'AI extraction confidence',
        status: 'warning',
        details: `Low confidence score (${(confidenceScore * 100).toFixed(0)}%) - manual review recommended`
      })
    }
  }

  return {
    status: overallStatus,
    checks,
    deficiencies,
    confidence_score: extractedData.extraction_confidence
  }
}

// GET /api/documents - List documents
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const subcontractorId = searchParams.get('subcontractorId')

    // Get documents using Convex
    const result = await convex.query(api.documents.listByCompany, {
      companyId: user.companyId,
      projectId: projectId ? projectId as Id<"projects"> : undefined,
      subcontractorId: subcontractorId ? subcontractorId as Id<"subcontractors"> : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get documents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/documents - Upload a new document
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    // Only certain roles can upload documents
    if (!['admin', 'risk_manager', 'project_manager', 'project_administrator'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to upload documents' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string | null
    const subcontractorId = formData.get('subcontractorId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!projectId || !subcontractorId) {
      return NextResponse.json({ error: 'Project ID and Subcontractor ID are required' }, { status: 400 })
    }

    // Validate file type (PDF or image)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif']
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json({
        error: `Invalid file type. Only PDF and image files are accepted (${allowedExtensions.join(', ')}). You uploaded: ${file.name}`
      }, { status: 400 })
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({
        error: 'File too large. Maximum size is 10MB'
      }, { status: 400 })
    }

    // Validate access to project
    const accessResult = await convex.query(api.projects.validateAccess, {
      projectId: projectId as Id<"projects">,
      userId: user._id,
      userRole: user.role,
      userCompanyId: user.companyId,
    })

    if (!accessResult.canAccess || !accessResult.project) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    const project = accessResult.project

    // Verify subcontractor exists and belongs to same company
    const subResult = await convex.query(api.projectSubcontractors.validateSubcontractor, {
      subcontractorId: subcontractorId as Id<"subcontractors">,
      companyId: user.companyId,
    })

    if (!subResult.valid || !subResult.subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    const subcontractor = subResult.subcontractor

    // Verify subcontractor is assigned to the project
    const assignment = await convex.query(api.projectSubcontractors.getByProjectAndSubcontractor, {
      projectId: projectId as Id<"projects">,
      subcontractorId: subcontractorId as Id<"subcontractors">,
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Subcontractor is not assigned to this project' }, { status: 400 })
    }

    // Upload file using storage library
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uploadResult = await uploadFile(buffer, file.name, {
      folder: 'documents',
      contentType: file.type
    })

    if (!uploadResult.success) {
      return NextResponse.json({
        error: `Failed to upload file: ${uploadResult.error}`
      }, { status: 500 })
    }

    const fileUrl = uploadResult.fileUrl
    const storageInfo = getStorageInfo()
    console.log(`[DOCUMENTS] File uploaded via ${storageInfo.provider}: ${fileUrl}`)

    // Create document record
    const documentId = await convex.mutation(api.documents.create, {
      subcontractorId: subcontractorId as Id<"subcontractors">,
      projectId: projectId as Id<"projects">,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      source: 'upload',
      receivedAt: Date.now(),
    })

    // Create initial verification record
    await convex.mutation(api.verifications.create, {
      cocDocumentId: documentId,
      projectId: projectId as Id<"projects">,
      status: 'review',
      extractedData: {},
      checks: [],
      deficiencies: [],
    })

    // Log the upload action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.companyId,
      userId: user._id,
      entityType: 'coc_document',
      entityId: documentId,
      action: 'upload',
      details: {
        fileName: file.name,
        fileSize: file.size,
        projectId,
        subcontractorId
      },
    })

    // Update document processing status to 'processing'
    await convex.mutation(api.documents.updateProcessingStatus, {
      id: documentId,
      processingStatus: 'processing',
      processedAt: Date.now(),
    })

    // Get URL search params for test toggles
    const { searchParams } = new URL(request.url)

    // Perform AI extraction using Gemini 3 Flash
    const extractionResult = await extractDocumentData(buffer, file.type, file.name)

    // Handle extraction failure
    if (!extractionResult.success || !extractionResult.data) {
      // Update document status to extraction_failed
      await convex.mutation(api.documents.updateProcessingStatus, {
        id: documentId,
        processingStatus: 'failed',
      })

      // Update verification record with failure
      await convex.mutation(api.verifications.upsert, {
        cocDocumentId: documentId,
        projectId: projectId as Id<"projects">,
        status: 'fail',
        extractedData: { extraction_error: extractionResult.error },
        checks: [],
        deficiencies: [],
      })

      // Log the extraction failure
      await convex.mutation(api.auditLogs.create, {
        companyId: user.companyId,
        userId: user._id,
        entityType: 'coc_document',
        entityId: documentId,
        action: 'extraction_failed',
        details: {
          error: extractionResult.error,
          fileName: file.name
        },
      })

      return NextResponse.json({
        success: false,
        status: 'extraction_failed',
        document: {
          id: documentId,
          fileUrl,
          fileName: file.name,
          processingStatus: 'extraction_failed'
        },
        error: {
          code: extractionResult.error?.code || 'UNREADABLE',
          message: extractionResult.error?.message || "We couldn't read your document. Please ensure it's a clear PDF or image of your Certificate of Currency.",
          actions: extractionResult.error?.retryable ? ['retry', 'upload_new'] : ['upload_new']
        }
      }, { status: 422 })
    }

    // Convert Gemini extraction to legacy format for verification
    const extractedData = convertToLegacyFormat(
      extractionResult.data,
      { name: subcontractor.name, abn: subcontractor.abn }
    )
    extractedData.extraction_confidence = extractionResult.confidence

    // Get insurance requirements
    const requirementsRaw = await convex.query(api.insuranceRequirements.getByProject, {
      projectId: projectId as Id<"projects">,
    })

    // Map requirements to expected format (convert undefined to null)
    const requirements: InsuranceRequirement[] = requirementsRaw.map(r => ({
      coverageType: r.coverageType,
      minimumLimit: r.minimumLimit ?? null,
      limitType: r.limitType ?? null,
      maximumExcess: r.maximumExcess ?? null,
      principalIndemnityRequired: r.principalIndemnityRequired,
      crossLiabilityRequired: r.crossLiabilityRequired,
      waiverOfSubrogationRequired: r.waiverOfSubrogationRequired,
      principalNamingRequired: r.principalNamingRequired ?? null,
    }))

    // Verify against requirements
    const verification = verifyAgainstRequirements(
      extractedData as unknown as ExtractedData,
      requirements,
      project.endDate,
      project.state,
      subcontractor.abn
    )

    // Check if fraud detection should be skipped (for testing)
    const skipFraud = shouldSkipFraudDetection(file.name, searchParams)

    // Perform fraud detection analysis
    const fraudAnalysis: FraudAnalysisResult = skipFraud
      ? {
          overall_risk_score: 0,
          risk_level: 'low' as const,
          is_blocked: false,
          recommendation: 'Fraud detection skipped for testing',
          checks: [],
          evidence_summary: ['Fraud detection was bypassed via test toggle']
        }
      : performSimulatedFraudAnalysis(
          {
            insured_party_abn: extractedData.insured_party_abn as string,
            insurer_name: extractedData.insurer_name as string,
            policy_number: extractedData.policy_number as string,
            period_of_insurance_start: extractedData.period_of_insurance_start as string,
            period_of_insurance_end: extractedData.period_of_insurance_end as string,
            coverages: (extractedData.coverages as Array<{type: string; limit: number}>).map(c => ({
              type: c.type,
              limit: c.limit
            }))
          },
          file.name
        )

    // If fraud is detected, override verification status
    let finalStatus = verification.status
    if (fraudAnalysis.is_blocked) {
      finalStatus = 'fail'
      verification.deficiencies.push({
        type: 'fraud_detected',
        severity: 'critical',
        description: `Document flagged for potential fraud: ${fraudAnalysis.recommendation}`,
        required_value: 'Authentic document',
        actual_value: `Risk level: ${fraudAnalysis.risk_level} (score: ${fraudAnalysis.overall_risk_score})`
      })
      for (const check of fraudAnalysis.checks.filter(c => c.status === 'fail')) {
        verification.checks.push({
          check_type: check.check_type,
          description: check.check_name,
          status: 'fail',
          details: check.details
        })
      }
    } else if (fraudAnalysis.risk_level === 'high' && finalStatus === 'pass') {
      finalStatus = 'review'
      verification.checks.push({
        check_type: 'fraud_risk_warning',
        description: 'Fraud Risk Assessment',
        status: 'warning',
        details: `${fraudAnalysis.recommendation} (Risk score: ${fraudAnalysis.overall_risk_score})`
      })
    }

    // Update verification record with extracted data and fraud analysis
    await convex.mutation(api.verifications.upsert, {
      cocDocumentId: documentId,
      projectId: projectId as Id<"projects">,
      status: finalStatus as 'pass' | 'fail' | 'review',
      confidenceScore: verification.confidence_score,
      extractedData: {
        ...extractedData,
        fraud_analysis: {
          risk_score: fraudAnalysis.overall_risk_score,
          risk_level: fraudAnalysis.risk_level,
          is_blocked: fraudAnalysis.is_blocked,
          recommendation: fraudAnalysis.recommendation,
          checks: fraudAnalysis.checks,
          evidence_summary: fraudAnalysis.evidence_summary
        }
      },
      checks: verification.checks,
      deficiencies: verification.deficiencies,
    })

    // Update document processing status to completed
    await convex.mutation(api.documents.updateProcessingStatus, {
      id: documentId,
      processingStatus: 'completed',
    })

    // Get names for notifications
    const subcontractorName = subcontractor.name
    const projectName = project.name

    // Update compliance status based on verification result
    if (finalStatus === 'pass') {
      await convex.mutation(api.projectSubcontractors.updateStatusByProjectAndSubcontractor, {
        projectId: projectId as Id<"projects">,
        subcontractorId: subcontractorId as Id<"subcontractors">,
        status: 'compliant',
      })

      // Log the auto-approval
      await convex.mutation(api.auditLogs.create, {
        companyId: user.companyId,
        userId: user._id,
        entityType: 'project_subcontractor',
        entityId: `${projectId}_${subcontractorId}`,
        action: 'auto_approve',
        details: {
          documentId,
          verificationStatus: 'pass',
          autoApproved: true,
          message: 'Subcontractor automatically marked compliant after verification passed'
        },
      })
    } else if (finalStatus === 'fail') {
      await convex.mutation(api.projectSubcontractors.updateStatusByProjectAndSubcontractor, {
        projectId: projectId as Id<"projects">,
        subcontractorId: subcontractorId as Id<"subcontractors">,
        status: 'non_compliant',
      })

      if (fraudAnalysis.is_blocked) {
        createNotificationForProjectTeam(
          projectId,
          'stop_work_risk',
          'FRAUD ALERT: Document Blocked',
          `${subcontractorName}'s Certificate of Currency has been blocked due to potential fraud. Risk score: ${fraudAnalysis.overall_risk_score}. ${fraudAnalysis.recommendation}`,
          `/dashboard/documents/${documentId}`,
          'coc_document',
          documentId
        )
      }
    }

    // Create notifications for project team
    if (finalStatus === 'pass') {
      createNotificationForProjectTeam(
        projectId,
        'coc_verified',
        'COC Verified - Compliant',
        `${subcontractorName}'s Certificate of Currency has passed verification for ${projectName}`,
        `/dashboard/documents/${documentId}`,
        'coc_document',
        documentId
      )
    } else if (finalStatus === 'fail' && !fraudAnalysis.is_blocked) {
      const deficiencyCount = verification.deficiencies.length
      createNotificationForProjectTeam(
        projectId,
        'coc_failed',
        'COC Verification Failed',
        `${subcontractorName}'s Certificate of Currency has ${deficiencyCount} deficienc${deficiencyCount === 1 ? 'y' : 'ies'} for ${projectName}`,
        `/dashboard/documents/${documentId}`,
        'coc_document',
        documentId
      )
    } else if (finalStatus === 'review') {
      createNotificationForProjectTeam(
        projectId,
        'coc_received',
        'COC Requires Review',
        `${subcontractorName}'s Certificate of Currency requires manual review for ${projectName}`,
        `/dashboard/documents/${documentId}`,
        'coc_document',
        documentId
      )
    }

    return NextResponse.json({
      success: true,
      message: fraudAnalysis.is_blocked
        ? 'Document uploaded but BLOCKED due to potential fraud'
        : 'Document uploaded successfully',
      document: {
        id: documentId,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        processingStatus: 'completed',
        storageProvider: uploadResult.provider,
        storagePath: uploadResult.storagePath,
        verification: {
          status: finalStatus,
          confidence_score: verification.confidence_score,
          extracted_data: extractedData
        },
        fraud_analysis: {
          risk_score: fraudAnalysis.overall_risk_score,
          risk_level: fraudAnalysis.risk_level,
          is_blocked: fraudAnalysis.is_blocked,
          recommendation: fraudAnalysis.recommendation,
          evidence_summary: fraudAnalysis.evidence_summary
        }
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Upload document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
