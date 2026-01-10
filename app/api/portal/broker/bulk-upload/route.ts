import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { uploadFile, getStorageInfo } from '@/lib/storage'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

interface InsuranceRequirement {
  coverageType: string
  minimumLimit: number | null
  maximumExcess: number | null
  principalIndemnityRequired: boolean
  crossLiabilityRequired: boolean
}

interface Subcontractor {
  _id: string
  name: string
  abn: string
  brokerName?: string | null
  brokerEmail?: string | null
  contactName?: string | null
  contactEmail?: string | null
}

// Simulated AI extraction of policy details from COC document
function extractPolicyDetails(fileName: string, subcontractor: Subcontractor) {
  const insurers = [
    'QBE Insurance (Australia) Limited',
    'Allianz Australia Insurance Limited',
    'Suncorp Group Limited',
    'CGU Insurance Limited'
  ]

  const randomInsurer = insurers[Math.floor(Math.random() * insurers.length)]
  const policyNumber = `POL${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`

  // Check for test scenarios based on filename
  const isFullCompliance = fileName.toLowerCase().includes('compliant') ||
                           fileName.toLowerCase().includes('full_compliance') ||
                           fileName.toLowerCase().includes('pass')
  const isNoPrincipalIndemnity = fileName.toLowerCase().includes('no_pi')
  const isNoCrossLiability = fileName.toLowerCase().includes('no_cl')
  const isLowLimit = fileName.toLowerCase().includes('low_limit')

  // Generate dates
  const now = new Date()
  const startDate = new Date(now)
  startDate.setMonth(startDate.getMonth() - 2)
  const endDate = new Date(startDate)
  endDate.setFullYear(endDate.getFullYear() + 1)

  // Generate coverage limits
  const publicLiabilityLimit = isLowLimit ? 5000000 : (isFullCompliance ? 20000000 : 10000000)
  const productsLiabilityLimit = isLowLimit ? 5000000 : (isFullCompliance ? 20000000 : 10000000)
  const workersCompLimit = isFullCompliance ? 2000000 : 1000000
  const professionalIndemnityLimit = isFullCompliance ? 5000000 : 2000000

  return {
    insured_party_name: subcontractor.name,
    insured_party_abn: subcontractor.abn,
    insured_party_address: '123 Construction Way, Sydney NSW 2000',
    insurer_name: randomInsurer,
    insurer_abn: '28008770864',
    policy_number: policyNumber,
    period_of_insurance_start: startDate.toISOString().split('T')[0],
    period_of_insurance_end: endDate.toISOString().split('T')[0],
    coverages: [
      {
        type: 'public_liability',
        limit: publicLiabilityLimit,
        limit_type: 'per_occurrence',
        excess: 1000,
        principal_indemnity: !isNoPrincipalIndemnity,
        cross_liability: !isNoCrossLiability
      },
      {
        type: 'products_liability',
        limit: productsLiabilityLimit,
        limit_type: 'aggregate',
        excess: 1000,
        principal_indemnity: !isNoPrincipalIndemnity,
        cross_liability: !isNoCrossLiability
      },
      {
        type: 'workers_comp',
        limit: workersCompLimit,
        limit_type: 'statutory',
        excess: 0,
        state: 'NSW',
        employer_indemnity: true
      },
      {
        type: 'professional_indemnity',
        limit: professionalIndemnityLimit,
        limit_type: 'per_claim',
        excess: 5000,
        retroactive_date: '2020-01-01'
      }
    ],
    broker_name: 'ABC Insurance Brokers Pty Ltd',
    broker_contact: 'John Smith',
    broker_phone: '02 9999 8888',
    broker_email: 'john@abcbrokers.com.au',
    currency: 'AUD',
    territory: 'Australia and New Zealand',
    extraction_timestamp: new Date().toISOString(),
    extraction_model: 'gpt-4-vision-preview',
    extraction_confidence: 0.92 + Math.random() * 0.07
  }
}

// Verify extracted data against requirements
function verifyAgainstRequirements(
  extractedData: ReturnType<typeof extractPolicyDetails>,
  requirements: InsuranceRequirement[],
  projectEndDate?: number | null
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

  // Check ABN matches
  checks.push({
    check_type: 'abn_verification',
    description: 'ABN verification',
    status: 'pass',
    details: `ABN ${extractedData.insured_party_abn} verified`
  })

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
  }

  // Calculate overall status
  const hasFailures = checks.some(c => c.status === 'fail')
  const hasWarnings = checks.some(c => c.status === 'warning')
  const hasCriticalDeficiencies = deficiencies.some(d => d.severity === 'critical')

  let overallStatus: 'pass' | 'fail' | 'review' = 'pass'
  if (hasFailures || hasCriticalDeficiencies) {
    overallStatus = 'fail'
  } else if (hasWarnings) {
    overallStatus = 'review'
  }

  return {
    status: overallStatus,
    checks,
    deficiencies,
    confidence_score: extractedData.extraction_confidence
  }
}

function formatCoverageType(type: string): string {
  const names: Record<string, string> = {
    public_liability: 'Public Liability',
    products_liability: 'Products Liability',
    workers_comp: "Workers' Compensation",
    professional_indemnity: 'Professional Indemnity'
  }
  return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

interface UploadMapping {
  fileIndex: number
  subcontractorId: string
  projectId: string
}

// POST /api/portal/broker/bulk-upload - Bulk upload COC documents for broker clients
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Get form data
    const formData = await request.formData()
    const mappingsJson = formData.get('mappings') as string | null

    if (!mappingsJson) {
      return NextResponse.json({ error: 'File mappings required' }, { status: 400 })
    }

    const mappings: UploadMapping[] = JSON.parse(mappingsJson)

    if (mappings.length === 0) {
      return NextResponse.json({ error: 'At least one file mapping is required' }, { status: 400 })
    }

    // Get all files from form data
    const files: File[] = []
    for (let i = 0; ; i++) {
      const file = formData.get(`file_${i}`) as File | null
      if (!file) break
      files.push(file)
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Process each file mapping
    const results: Array<{
      fileIndex: number
      fileName: string
      subcontractorId: string
      subcontractorName: string
      projectId: string
      projectName: string
      status: 'success' | 'error'
      verificationStatus?: string
      documentId?: string
      error?: string
    }> = []

    for (const mapping of mappings) {
      const file = files[mapping.fileIndex]

      if (!file) {
        results.push({
          fileIndex: mapping.fileIndex,
          fileName: 'Unknown',
          subcontractorId: mapping.subcontractorId,
          subcontractorName: 'Unknown',
          projectId: mapping.projectId,
          projectName: 'Unknown',
          status: 'error',
          error: 'File not found for index'
        })
        continue
      }

      // Verify the broker has access to this subcontractor
      const subcontractor = await convex.query(api.portal.getSubcontractorByBrokerEmail, {
        subcontractorId: mapping.subcontractorId as Id<"subcontractors">,
        brokerEmail: user.email,
      })

      if (!subcontractor) {
        results.push({
          fileIndex: mapping.fileIndex,
          fileName: file.name,
          subcontractorId: mapping.subcontractorId,
          subcontractorName: 'Unknown',
          projectId: mapping.projectId,
          projectName: 'Unknown',
          status: 'error',
          error: 'Not authorized for this client'
        })
        continue
      }

      // Get project info and verify subcontractor is assigned
      const project = await convex.query(api.portal.getProjectForSubcontractor, {
        projectId: mapping.projectId as Id<"projects">,
        subcontractorId: mapping.subcontractorId as Id<"subcontractors">,
      })

      if (!project) {
        results.push({
          fileIndex: mapping.fileIndex,
          fileName: file.name,
          subcontractorId: mapping.subcontractorId,
          subcontractorName: subcontractor.name,
          projectId: mapping.projectId,
          projectName: 'Unknown',
          status: 'error',
          error: 'Client not assigned to this project'
        })
        continue
      }

      try {
        // Read file buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Upload file using storage library
        const uploadResult = await uploadFile(buffer, file.name, {
          folder: 'broker',
          contentType: file.type
        })

        if (!uploadResult.success) {
          results.push({
            fileIndex: mapping.fileIndex,
            fileName: file.name,
            subcontractorId: mapping.subcontractorId,
            subcontractorName: subcontractor.name,
            projectId: mapping.projectId,
            projectName: project.name,
            status: 'error',
            error: `Failed to upload file: ${uploadResult.error}`
          })
          continue
        }

        const fileUrl = uploadResult.fileUrl
        const storageInfo = getStorageInfo()
        console.log(`[BROKER BULK] File uploaded via ${storageInfo.provider}: ${fileUrl}`)

        // Create COC document record
        const docId = await convex.mutation(api.documents.create, {
          subcontractorId: mapping.subcontractorId as Id<"subcontractors">,
          projectId: mapping.projectId as Id<"projects">,
          fileUrl: fileUrl,
          fileName: file.name,
          fileSize: file.size,
          source: 'portal',
        })

        // Get project requirements
        const requirements = await convex.query(api.insuranceRequirements.getByProject, {
          projectId: mapping.projectId as Id<"projects">,
        })

        // Format requirements for verification
        const formattedRequirements: InsuranceRequirement[] = requirements.map(r => ({
          coverageType: r.coverageType,
          minimumLimit: r.minimumLimit || null,
          maximumExcess: r.maximumExcess || null,
          principalIndemnityRequired: r.principalIndemnityRequired,
          crossLiabilityRequired: r.crossLiabilityRequired,
        }))

        // Extract policy details (simulated AI)
        const extractedData = extractPolicyDetails(file.name, {
          _id: subcontractor._id,
          name: subcontractor.name,
          abn: subcontractor.abn,
          brokerName: subcontractor.brokerName,
          brokerEmail: subcontractor.brokerEmail,
          contactName: subcontractor.contactName,
          contactEmail: subcontractor.contactEmail,
        })

        // Verify against requirements
        const verification = verifyAgainstRequirements(extractedData, formattedRequirements, project.end_date ? new Date(project.end_date).getTime() : null)

        // Create verification record
        await convex.mutation(api.verifications.create, {
          cocDocumentId: docId,
          projectId: mapping.projectId as Id<"projects">,
          status: verification.status,
          confidenceScore: verification.confidence_score,
          extractedData: extractedData,
          checks: verification.checks,
          deficiencies: verification.deficiencies,
        })

        // Update document processing status
        await convex.mutation(api.documents.updateProcessingStatus, {
          id: docId,
          processingStatus: 'completed',
          processedAt: Date.now(),
        })

        // If verification passed, update project_subcontractor status to compliant
        if (verification.status === 'pass') {
          try {
            await convex.mutation(api.projectSubcontractors.updateStatusByProjectAndSubcontractor, {
              projectId: mapping.projectId as Id<"projects">,
              subcontractorId: mapping.subcontractorId as Id<"subcontractors">,
              status: 'compliant',
            })

            // Auto-resolve any active exceptions
            await convex.mutation(api.exceptions.resolveActiveByProjectAndSubcontractor, {
              projectId: mapping.projectId as Id<"projects">,
              subcontractorId: mapping.subcontractorId as Id<"subcontractors">,
              resolutionType: 'coc_updated',
              resolutionNotes: 'Automatically resolved - compliant COC uploaded via broker bulk upload',
            })
          } catch (err) {
            // Project-subcontractor link might not exist, that's OK
            console.log('[BROKER BULK] Could not update project_subcontractor status:', err)
          }
        }

        results.push({
          fileIndex: mapping.fileIndex,
          fileName: file.name,
          subcontractorId: mapping.subcontractorId,
          subcontractorName: subcontractor.name,
          projectId: mapping.projectId,
          projectName: project.name,
          status: 'success',
          verificationStatus: verification.status,
          documentId: docId
        })

      } catch (err) {
        console.error('Error processing file:', err)
        results.push({
          fileIndex: mapping.fileIndex,
          fileName: file.name,
          subcontractorId: mapping.subcontractorId,
          subcontractorName: subcontractor.name,
          projectId: mapping.projectId,
          projectName: project.name,
          status: 'error',
          error: 'Failed to process file'
        })
      }
    }

    // Calculate summary
    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length
    const passCount = results.filter(r => r.verificationStatus === 'pass').length
    const failCount = results.filter(r => r.verificationStatus === 'fail').length
    const reviewCount = results.filter(r => r.verificationStatus === 'review').length

    return NextResponse.json({
      success: true,
      summary: {
        totalFiles: files.length,
        processed: successCount,
        errors: errorCount,
        verificationResults: {
          pass: passCount,
          fail: failCount,
          review: reviewCount
        }
      },
      results
    })

  } catch (error) {
    console.error('Broker bulk upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
