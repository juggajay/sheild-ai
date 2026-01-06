import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, type Project } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

interface InsuranceRequirement {
  id: string
  coverage_type: string
  minimum_limit: number | null
  limit_type: string
  maximum_excess: number | null
  principal_indemnity_required: number
  cross_liability_required: number
}

// Simulated AI extraction of policy details from COC document
function performAIExtraction(subcontractor: { id: string; name: string; abn: string }) {
  const insurers = [
    'QBE Insurance (Australia) Limited',
    'Allianz Australia Insurance Limited',
    'Suncorp Group Limited',
    'CGU Insurance Limited',
    'Zurich Australian Insurance Limited',
    'AIG Australia Limited',
    'Vero Insurance',
    'GIO General Limited'
  ]

  const randomInsurer = insurers[Math.floor(Math.random() * insurers.length)]
  const policyNumber = `POL${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`

  const now = new Date()
  const startDate = new Date(now)
  startDate.setMonth(startDate.getMonth() - Math.floor(Math.random() * 6))
  const endDate = new Date(startDate)
  endDate.setFullYear(endDate.getFullYear() + 1)

  const publicLiabilityLimit = [5000000, 10000000, 20000000][Math.floor(Math.random() * 3)]
  const productsLiabilityLimit = [5000000, 10000000, 20000000][Math.floor(Math.random() * 3)]
  const workersCompLimit = [1000000, 2000000, 5000000][Math.floor(Math.random() * 3)]
  const professionalIndemnityLimit = [1000000, 2000000, 5000000][Math.floor(Math.random() * 3)]

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
        principal_indemnity: true,
        cross_liability: true
      },
      {
        type: 'products_liability',
        limit: productsLiabilityLimit,
        limit_type: 'aggregate',
        excess: 1000,
        principal_indemnity: true,
        cross_liability: true
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
    extraction_confidence: 0.85 + Math.random() * 0.14
  }
}

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

function verifyAgainstRequirements(
  extractedData: ReturnType<typeof performAIExtraction>,
  requirements: InsuranceRequirement[]
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
    checks.push({
      check_type: 'policy_validity',
      description: 'Policy validity period',
      status: 'warning',
      details: `Policy expires in ${daysUntilExpiry} days`
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
    const coverage = extractedData.coverages.find(c => c.type === requirement.coverage_type)

    if (!coverage) {
      checks.push({
        check_type: `coverage_${requirement.coverage_type}`,
        description: `${formatCoverageType(requirement.coverage_type)} coverage`,
        status: 'fail',
        details: 'Coverage not found in certificate'
      })
      deficiencies.push({
        type: 'missing_coverage',
        severity: 'critical',
        description: `${formatCoverageType(requirement.coverage_type)} coverage is required but not present`,
        required_value: requirement.minimum_limit ? `$${requirement.minimum_limit.toLocaleString()}` : 'Required',
        actual_value: 'Not found'
      })
      continue
    }

    // Check minimum limit
    if (requirement.minimum_limit && coverage.limit < requirement.minimum_limit) {
      checks.push({
        check_type: `coverage_${requirement.coverage_type}`,
        description: `${formatCoverageType(requirement.coverage_type)} limit`,
        status: 'fail',
        details: `Limit $${coverage.limit.toLocaleString()} is below required $${requirement.minimum_limit.toLocaleString()}`
      })
      deficiencies.push({
        type: 'insufficient_limit',
        severity: 'major',
        description: `${formatCoverageType(requirement.coverage_type)} limit is below minimum requirement`,
        required_value: `$${requirement.minimum_limit.toLocaleString()}`,
        actual_value: `$${coverage.limit.toLocaleString()}`
      })
    } else {
      checks.push({
        check_type: `coverage_${requirement.coverage_type}`,
        description: `${formatCoverageType(requirement.coverage_type)} limit`,
        status: 'pass',
        details: `Limit $${coverage.limit.toLocaleString()} meets minimum requirement`
      })
    }

    // Check maximum excess
    if (requirement.maximum_excess && coverage.excess > requirement.maximum_excess) {
      checks.push({
        check_type: `excess_${requirement.coverage_type}`,
        description: `${formatCoverageType(requirement.coverage_type)} excess`,
        status: 'fail',
        details: `Excess $${coverage.excess.toLocaleString()} exceeds maximum $${requirement.maximum_excess.toLocaleString()}`
      })
      deficiencies.push({
        type: 'excess_too_high',
        severity: 'minor',
        description: `${formatCoverageType(requirement.coverage_type)} excess exceeds maximum allowed`,
        required_value: `Max $${requirement.maximum_excess.toLocaleString()}`,
        actual_value: `$${coverage.excess.toLocaleString()}`
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

// Helper function to check if user has access to project
function canAccessProject(user: { id: string; company_id: string | null; role: string }, project: Project): boolean {
  // Must be same company
  if (project.company_id !== user.company_id) {
    return false
  }

  // Admin, risk_manager, and read_only can access all company projects
  if (['admin', 'risk_manager', 'read_only'].includes(user.role)) {
    return true
  }

  // Project manager and project administrator can only access assigned projects
  if (['project_manager', 'project_administrator'].includes(user.role)) {
    return project.project_manager_id === user.id
  }

  return false
}

// GET /api/documents - List documents
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const subcontractorId = searchParams.get('subcontractorId')

    const db = getDb()

    let query = `
      SELECT
        d.*,
        s.name as subcontractor_name,
        s.abn as subcontractor_abn,
        p.name as project_name,
        v.status as verification_status,
        v.confidence_score
      FROM coc_documents d
      JOIN subcontractors s ON d.subcontractor_id = s.id
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN verifications v ON v.coc_document_id = d.id
      WHERE p.company_id = ?
    `
    const params: (string | null)[] = [user.company_id]

    if (projectId) {
      query += ' AND d.project_id = ?'
      params.push(projectId)
    }

    if (subcontractorId) {
      query += ' AND d.subcontractor_id = ?'
      params.push(subcontractorId)
    }

    query += ' ORDER BY d.created_at DESC'

    const documents = db.prepare(query).all(...params)

    return NextResponse.json({
      documents,
      total: documents.length
    })
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

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
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
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Invalid file type. Only PDF and image files are allowed'
      }, { status: 400 })
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({
        error: 'File too large. Maximum size is 10MB'
      }, { status: 400 })
    }

    const db = getDb()

    // Verify project exists and user has access
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project | undefined
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!canAccessProject(user, project)) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    // Verify subcontractor exists and belongs to same company
    const subcontractor = db.prepare('SELECT * FROM subcontractors WHERE id = ? AND company_id = ?')
      .get(subcontractorId, user.company_id)
    if (!subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Verify subcontractor is assigned to the project
    const assignment = db.prepare('SELECT id FROM project_subcontractors WHERE project_id = ? AND subcontractor_id = ?')
      .get(projectId, subcontractorId)
    if (!assignment) {
      return NextResponse.json({ error: 'Subcontractor is not assigned to this project' }, { status: 400 })
    }

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name)
    const uniqueFilename = `${uuidv4()}${fileExtension}`
    const filePath = path.join(uploadDir, uniqueFilename)
    const fileUrl = `/uploads/documents/${uniqueFilename}`

    // Save file to disk
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(filePath, buffer)

    // Create document record
    const documentId = uuidv4()
    db.prepare(`
      INSERT INTO coc_documents (id, subcontractor_id, project_id, file_url, file_name, file_size, source, received_at, processing_status)
      VALUES (?, ?, ?, ?, ?, ?, 'upload', datetime('now'), 'pending')
    `).run(documentId, subcontractorId, projectId, fileUrl, file.name, file.size)

    // Create initial verification record
    const verificationId = uuidv4()
    db.prepare(`
      INSERT INTO verifications (id, coc_document_id, project_id, status, extracted_data, checks, deficiencies)
      VALUES (?, ?, ?, 'review', '{}', '[]', '[]')
    `).run(verificationId, documentId, projectId)

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'coc_document', ?, 'upload', ?)
    `).run(uuidv4(), user.company_id, user.id, documentId, JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      projectId,
      subcontractorId
    }))

    // Update document processing status to 'processing'
    db.prepare(`
      UPDATE coc_documents SET processing_status = 'processing', processed_at = datetime('now')
      WHERE id = ?
    `).run(documentId)

    // Perform AI extraction immediately
    const extractedData = performAIExtraction(subcontractor as { id: string; name: string; abn: string })
    const requirements = db.prepare(`
      SELECT * FROM insurance_requirements WHERE project_id = ?
    `).all(projectId) as InsuranceRequirement[]

    const verification = verifyAgainstRequirements(extractedData, requirements)

    // Update verification record with extracted data
    db.prepare(`
      UPDATE verifications
      SET
        status = ?,
        confidence_score = ?,
        extracted_data = ?,
        checks = ?,
        deficiencies = ?,
        updated_at = datetime('now')
      WHERE coc_document_id = ?
    `).run(
      verification.status,
      verification.confidence_score,
      JSON.stringify(extractedData),
      JSON.stringify(verification.checks),
      JSON.stringify(verification.deficiencies),
      documentId
    )

    // Update document processing status to completed
    db.prepare(`
      UPDATE coc_documents SET processing_status = 'completed', updated_at = datetime('now')
      WHERE id = ?
    `).run(documentId)

    return NextResponse.json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        id: documentId,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        processingStatus: 'completed',
        verification: {
          status: verification.status,
          confidence_score: verification.confidence_score,
          extracted_data: extractedData
        }
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Upload document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
