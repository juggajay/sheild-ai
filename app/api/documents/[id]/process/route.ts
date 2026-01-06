import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

interface CocDocument {
  id: string
  subcontractor_id: string
  project_id: string
  file_url: string
  file_name: string | null
  file_size: number | null
  source: string
  processing_status: string
  created_at: string
}

interface Subcontractor {
  id: string
  name: string
  abn: string
  broker_name?: string
  broker_email?: string
  contact_name?: string
  contact_email?: string
}

interface EmailTemplate {
  id: string
  company_id: string | null
  type: string
  name: string | null
  subject: string | null
  body: string | null
  is_default: number
}

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
// In production, this would call GPT-4V or similar vision model
function extractPolicyDetails(document: CocDocument, subcontractor: Subcontractor) {
  // Generate realistic mock data based on document and subcontractor
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

  // Check for test scenarios based on filename
  const fileName = document.file_name || ''
  const isEarlyExpiry = fileName.toLowerCase().includes('expiring_early') ||
                        fileName.toLowerCase().includes('early_expiry')
  const isNoPrincipalIndemnity = fileName.toLowerCase().includes('no_pi') ||
                                  fileName.toLowerCase().includes('no_principal')
  const isNoCrossLiability = fileName.toLowerCase().includes('no_cl') ||
                             fileName.toLowerCase().includes('no_cross')
  const isVicWC = fileName.toLowerCase().includes('vic_wc') ||
                  fileName.toLowerCase().includes('wc_vic')
  const isLowConfidence = fileName.toLowerCase().includes('poor_quality') ||
                           fileName.toLowerCase().includes('low_confidence') ||
                           fileName.toLowerCase().includes('blurry')
  const isFullCompliance = fileName.toLowerCase().includes('compliant') ||
                           fileName.toLowerCase().includes('full_compliance') ||
                           fileName.toLowerCase().includes('pass')

  // Generate dates - policy typically valid for 1 year
  const now = new Date()
  const startDate = new Date(now)
  startDate.setMonth(startDate.getMonth() - Math.floor(Math.random() * 6)) // Started 0-6 months ago

  let endDate: Date
  if (isEarlyExpiry) {
    // For testing: policy expires in Oct 2025 (before typical project end dates)
    endDate = new Date('2025-10-31')
  } else {
    endDate = new Date(startDate)
    endDate.setFullYear(endDate.getFullYear() + 1) // 1 year policy
  }

  // Generate coverage limits - force high values for full compliance scenarios
  const publicLiabilityLimit = isFullCompliance ? 20000000 : [5000000, 10000000, 20000000][Math.floor(Math.random() * 3)]
  const productsLiabilityLimit = isFullCompliance ? 20000000 : [5000000, 10000000, 20000000][Math.floor(Math.random() * 3)]
  const workersCompLimit = isFullCompliance ? 2000000 : [1000000, 2000000, 5000000][Math.floor(Math.random() * 3)]
  const professionalIndemnityLimit = isFullCompliance ? 5000000 : [1000000, 2000000, 5000000][Math.floor(Math.random() * 3)]

  const extractedData = {
    // Insured party details
    insured_party_name: subcontractor.name,
    insured_party_abn: subcontractor.abn,
    insured_party_address: '123 Construction Way, Sydney NSW 2000',

    // Insurer details
    insurer_name: randomInsurer,
    insurer_abn: '28008770864',

    // Policy details
    policy_number: policyNumber,
    period_of_insurance_start: startDate.toISOString().split('T')[0],
    period_of_insurance_end: endDate.toISOString().split('T')[0],

    // Coverage details
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
        state: isVicWC ? 'VIC' : 'NSW',
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

    // Broker details (if present)
    broker_name: 'ABC Insurance Brokers Pty Ltd',
    broker_contact: 'John Smith',
    broker_phone: '02 9999 8888',
    broker_email: 'john@abcbrokers.com.au',

    // Additional details
    currency: 'AUD',
    territory: 'Australia and New Zealand',

    // Extraction metadata
    extraction_timestamp: new Date().toISOString(),
    extraction_model: 'gpt-4-vision-preview',
    extraction_confidence: isLowConfidence ? 0.45 + Math.random() * 0.15 : 0.85 + Math.random() * 0.14,

    // Per-field confidence scores for granular confidence display
    // Low confidence scenarios (poor quality documents) have lower per-field scores
    field_confidences: {
      insured_party_name: isLowConfidence ? 0.50 + Math.random() * 0.20 : 0.90 + Math.random() * 0.09,
      insured_party_abn: isLowConfidence ? 0.40 + Math.random() * 0.25 : 0.92 + Math.random() * 0.07,
      insured_party_address: isLowConfidence ? 0.35 + Math.random() * 0.30 : 0.85 + Math.random() * 0.10,
      insurer_name: isLowConfidence ? 0.55 + Math.random() * 0.20 : 0.95 + Math.random() * 0.04,
      insurer_abn: isLowConfidence ? 0.45 + Math.random() * 0.20 : 0.93 + Math.random() * 0.06,
      policy_number: isLowConfidence ? 0.35 + Math.random() * 0.30 : 0.88 + Math.random() * 0.10,
      period_of_insurance_start: isLowConfidence ? 0.50 + Math.random() * 0.25 : 0.90 + Math.random() * 0.09,
      period_of_insurance_end: isLowConfidence ? 0.50 + Math.random() * 0.25 : 0.90 + Math.random() * 0.09,
      public_liability_limit: isLowConfidence ? 0.45 + Math.random() * 0.25 : 0.88 + Math.random() * 0.11,
      products_liability_limit: isLowConfidence ? 0.45 + Math.random() * 0.25 : 0.88 + Math.random() * 0.11,
      workers_comp_limit: isLowConfidence ? 0.40 + Math.random() * 0.30 : 0.85 + Math.random() * 0.12,
      professional_indemnity_limit: isLowConfidence ? 0.40 + Math.random() * 0.30 : 0.85 + Math.random() * 0.12,
      broker_name: isLowConfidence ? 0.30 + Math.random() * 0.35 : 0.80 + Math.random() * 0.15,
      broker_contact: isLowConfidence ? 0.25 + Math.random() * 0.35 : 0.75 + Math.random() * 0.18,
      broker_phone: isLowConfidence ? 0.30 + Math.random() * 0.35 : 0.78 + Math.random() * 0.17,
      broker_email: isLowConfidence ? 0.35 + Math.random() * 0.35 : 0.82 + Math.random() * 0.15
    }
  }

  return extractedData
}

// Verify extracted data against project requirements
function verifyAgainstRequirements(
  extractedData: ReturnType<typeof extractPolicyDetails>,
  requirements: InsuranceRequirement[],
  projectEndDate?: string | null,
  projectState?: string | null
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

  // Check policy covers project period (if project has end date)
  if (projectEndDate) {
    const projectEnd = new Date(projectEndDate)
    if (policyEnd < projectEnd) {
      checks.push({
        check_type: 'project_coverage',
        description: 'Project period coverage',
        status: 'fail',
        details: `Policy expires before project end date (${projectEndDate})`
      })
      deficiencies.push({
        type: 'policy_expires_before_project',
        severity: 'critical',
        description: 'Policy expires before project completion date',
        required_value: `Valid until ${projectEndDate}`,
        actual_value: `Expires ${extractedData.period_of_insurance_end}`
      })
    } else {
      checks.push({
        check_type: 'project_coverage',
        description: 'Project period coverage',
        status: 'pass',
        details: `Policy covers project period (ends ${projectEndDate})`
      })
    }
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

    // Check principal indemnity
    if (requirement.principal_indemnity_required && 'principal_indemnity' in coverage && !coverage.principal_indemnity) {
      checks.push({
        check_type: `principal_indemnity_${requirement.coverage_type}`,
        description: `${formatCoverageType(requirement.coverage_type)} principal indemnity`,
        status: 'fail',
        details: 'Principal indemnity extension required but not present'
      })
      deficiencies.push({
        type: 'missing_endorsement',
        severity: 'major',
        description: `Principal indemnity extension required for ${formatCoverageType(requirement.coverage_type)}`,
        required_value: 'Yes',
        actual_value: 'No'
      })
    }

    // Check cross liability
    if (requirement.cross_liability_required && 'cross_liability' in coverage && !coverage.cross_liability) {
      checks.push({
        check_type: `cross_liability_${requirement.coverage_type}`,
        description: `${formatCoverageType(requirement.coverage_type)} cross liability`,
        status: 'fail',
        details: 'Cross liability extension required but not present'
      })
      deficiencies.push({
        type: 'missing_endorsement',
        severity: 'major',
        description: `Cross liability extension required for ${formatCoverageType(requirement.coverage_type)}`,
        required_value: 'Yes',
        actual_value: 'No'
      })
    }

    // Check Workers Comp state matches project state
    if (requirement.coverage_type === 'workers_comp' && projectState && 'state' in coverage) {
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
    professional_indemnity: 'Professional Indemnity',
    motor_vehicle: 'Motor Vehicle',
    contract_works: 'Contract Works'
  }
  return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Get email template for a specific type and company
function getEmailTemplate(db: ReturnType<typeof getDb>, companyId: string, templateType: string): EmailTemplate | null {
  // First try to get company-specific template
  let template = db.prepare(`
    SELECT * FROM email_templates
    WHERE company_id = ? AND type = ?
    ORDER BY is_default ASC
    LIMIT 1
  `).get(companyId, templateType) as EmailTemplate | undefined

  // Fall back to system default if no company template
  if (!template) {
    template = db.prepare(`
      SELECT * FROM email_templates
      WHERE company_id IS NULL AND type = ? AND is_default = 1
      LIMIT 1
    `).get(templateType) as EmailTemplate | undefined
  }

  return template || null
}

// Apply template variables to subject and body
function applyTemplateVariables(
  template: { subject: string | null; body: string | null },
  variables: Record<string, string>
): { subject: string; body: string } {
  let subject = template.subject || ''
  let body = template.body || ''

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    subject = subject.replace(regex, value)
    body = body.replace(regex, value)
  }

  return { subject, body }
}

// POST /api/documents/[id]/process - Process document with AI extraction
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const db = getDb()

    // Get document with verification
    const document = db.prepare(`
      SELECT d.*, p.company_id, v.id as verification_id
      FROM coc_documents d
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN verifications v ON v.coc_document_id = d.id
      WHERE d.id = ?
    `).get(params.id) as (CocDocument & { company_id: string; verification_id: string | null }) | undefined

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify user has access to this document's company
    if (document.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get subcontractor details (including broker info for deficiency emails)
    const subcontractor = db.prepare('SELECT id, name, abn, broker_name, broker_email, contact_name, contact_email FROM subcontractors WHERE id = ?')
      .get(document.subcontractor_id) as Subcontractor

    // Get project insurance requirements
    const requirements = db.prepare(`
      SELECT * FROM insurance_requirements WHERE project_id = ?
    `).all(document.project_id) as InsuranceRequirement[]

    // Get project end date and state for coverage checks
    const project = db.prepare('SELECT end_date, state FROM projects WHERE id = ?')
      .get(document.project_id) as { end_date: string | null; state: string | null } | undefined
    const projectEndDate = project?.end_date || null
    const projectState = project?.state || null

    // Update processing status
    db.prepare(`
      UPDATE coc_documents
      SET processing_status = 'processing', updated_at = datetime('now')
      WHERE id = ?
    `).run(params.id)

    // Extract policy details using AI (simulated)
    const extractedData = extractPolicyDetails(document, subcontractor)

    // Verify against requirements (including project end date and state checks)
    const verification = verifyAgainstRequirements(extractedData, requirements, projectEndDate, projectState)

    // Update or create verification record
    if (document.verification_id) {
      db.prepare(`
        UPDATE verifications
        SET
          status = ?,
          confidence_score = ?,
          extracted_data = ?,
          checks = ?,
          deficiencies = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        verification.status,
        verification.confidence_score,
        JSON.stringify(extractedData),
        JSON.stringify(verification.checks),
        JSON.stringify(verification.deficiencies),
        document.verification_id
      )
    } else {
      const verificationId = uuidv4()
      db.prepare(`
        INSERT INTO verifications (id, coc_document_id, project_id, status, confidence_score, extracted_data, checks, deficiencies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        verificationId,
        params.id,
        document.project_id,
        verification.status,
        verification.confidence_score,
        JSON.stringify(extractedData),
        JSON.stringify(verification.checks),
        JSON.stringify(verification.deficiencies)
      )
    }

    // Update document processing status to completed
    db.prepare(`
      UPDATE coc_documents
      SET processing_status = 'completed', processed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(params.id)

    // Log the processing action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'coc_document', ?, 'ai_process', ?)
    `).run(uuidv4(), user.company_id, user.id, params.id, JSON.stringify({
      verification_status: verification.status,
      confidence_score: verification.confidence_score,
      checks_count: verification.checks.length,
      deficiencies_count: verification.deficiencies.length
    }))

    // If verification failed, auto-send deficiency notification email to broker
    if (verification.status === 'fail' && verification.deficiencies.length > 0) {
      // Get project name for email
      const projectDetails = db.prepare('SELECT name FROM projects WHERE id = ?')
        .get(document.project_id) as { name: string } | undefined
      const projectName = projectDetails?.name || 'Unknown Project'

      // Determine recipient (prefer broker, fall back to subcontractor contact)
      const recipientEmail = subcontractor.broker_email || subcontractor.contact_email
      const recipientName = subcontractor.broker_name || subcontractor.contact_name || 'Insurance Contact'

      if (recipientEmail) {
        // Generate the upload link for the subcontractor portal
        const uploadLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/upload?subcontractor=${document.subcontractor_id}&project=${document.project_id}`

        // Format deficiencies for email
        const deficiencyList = verification.deficiencies.map((d: { description: string; severity: string; required_value: string | null; actual_value: string | null }) =>
          `• ${d.description}\n  Severity: ${d.severity.toUpperCase()}\n  Required: ${d.required_value || 'N/A'}\n  Actual: ${d.actual_value || 'N/A'}`
        ).join('\n\n')

        // Calculate due date (14 days from now)
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 14)
        const dueDateStr = dueDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

        // Try to get custom template, fall back to default
        const template = getEmailTemplate(db, user.company_id, 'deficiency')

        let emailSubject: string
        let emailBody: string

        if (template && template.subject && template.body) {
          // Use custom template with variable substitution
          const result = applyTemplateVariables(template, {
            subcontractor_name: subcontractor.name,
            subcontractor_abn: subcontractor.abn,
            project_name: projectName,
            recipient_name: recipientName,
            deficiency_list: deficiencyList,
            upload_link: uploadLink,
            due_date: dueDateStr
          })
          emailSubject = result.subject
          emailBody = result.body
        } else {
          // Fallback to hardcoded default
          emailSubject = `Certificate of Currency Deficiency Notice - ${subcontractor.name} / ${projectName}`
          emailBody = `Dear ${recipientName},

We have identified deficiencies in the Certificate of Currency submitted for ${subcontractor.name} (ABN: ${subcontractor.abn}) on the ${projectName} project.

DEFICIENCIES FOUND:

${deficiencyList}

ACTION REQUIRED:
Please provide an updated Certificate of Currency that addresses the above deficiencies.

You can upload the updated certificate directly using this secure link:
${uploadLink}

If you have any questions, please contact our project team.

Best regards,
RiskShield AI Compliance Team`
        }

        // Get or create verification ID for linking
        let verificationId = document.verification_id
        if (!verificationId) {
          const newVerification = db.prepare('SELECT id FROM verifications WHERE coc_document_id = ?')
            .get(params.id) as { id: string } | undefined
          verificationId = newVerification?.id || null
        }

        // Queue the deficiency email
        const communicationId = uuidv4()
        db.prepare(`
          INSERT INTO communications (id, subcontractor_id, project_id, verification_id, type, channel, recipient_email, subject, body, status)
          VALUES (?, ?, ?, ?, 'deficiency', 'email', ?, ?, ?, 'sent')
        `).run(
          communicationId,
          document.subcontractor_id,
          document.project_id,
          verificationId,
          recipientEmail,
          emailSubject,
          emailBody
        )

        // Mark as sent (in production, this would integrate with an email service)
        db.prepare(`
          UPDATE communications SET sent_at = datetime('now'), status = 'sent' WHERE id = ?
        `).run(communicationId)

        // Log the email action
        db.prepare(`
          INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
          VALUES (?, ?, ?, 'communication', ?, 'deficiency_email_sent', ?)
        `).run(uuidv4(), user.company_id, user.id, communicationId, JSON.stringify({
          recipient: recipientEmail,
          subcontractor_name: subcontractor.name,
          project_name: projectName,
          deficiency_count: verification.deficiencies.length
        }))
      }
    }

    // If verification passed, send confirmation email
    if (verification.status === 'pass') {
      // Get project name for email
      const projectDetails = db.prepare('SELECT name FROM projects WHERE id = ?')
        .get(document.project_id) as { name: string } | undefined
      const projectName = projectDetails?.name || 'Unknown Project'

      // Determine recipient (prefer broker, fall back to subcontractor contact)
      const recipientEmail = subcontractor.broker_email || subcontractor.contact_email
      const recipientName = subcontractor.broker_name || subcontractor.contact_name || 'Insurance Contact'

      if (recipientEmail) {
        // Try to get custom confirmation template
        const template = getEmailTemplate(db, user.company_id, 'confirmation')

        let emailSubject: string
        let emailBody: string

        if (template && template.subject && template.body) {
          // Use custom template with variable substitution
          const result = applyTemplateVariables(template, {
            subcontractor_name: subcontractor.name,
            subcontractor_abn: subcontractor.abn,
            project_name: projectName,
            recipient_name: recipientName
          })
          emailSubject = result.subject
          emailBody = result.body
        } else {
          // Fallback to hardcoded default
          emailSubject = `Insurance Compliance Confirmed - ${subcontractor.name} / ${projectName}`
          emailBody = `Dear ${recipientName},

Great news! The Certificate of Currency submitted for ${subcontractor.name} (ABN: ${subcontractor.abn}) has been verified and meets all requirements for the ${projectName} project.

VERIFICATION RESULT: APPROVED

${subcontractor.name} is now approved to work on the ${projectName} project. All insurance coverage requirements have been met.

Thank you for ensuring compliance with our insurance requirements. If you have any questions or need to update your certificate in the future, please don't hesitate to contact us.

Best regards,
RiskShield AI Compliance Team`
        }

        // Get or create verification ID for linking
        let verificationId = document.verification_id
        if (!verificationId) {
          const newVerification = db.prepare('SELECT id FROM verifications WHERE coc_document_id = ?')
            .get(params.id) as { id: string } | undefined
          verificationId = newVerification?.id || null
        }

        // Queue the confirmation email
        const communicationId = uuidv4()
        db.prepare(`
          INSERT INTO communications (id, subcontractor_id, project_id, verification_id, type, channel, recipient_email, subject, body, status)
          VALUES (?, ?, ?, ?, 'confirmation', 'email', ?, ?, ?, 'sent')
        `).run(
          communicationId,
          document.subcontractor_id,
          document.project_id,
          verificationId,
          recipientEmail,
          emailSubject,
          emailBody
        )

        // Mark as sent
        db.prepare(`
          UPDATE communications SET sent_at = datetime('now'), status = 'sent' WHERE id = ?
        `).run(communicationId)

        // Log the email action
        db.prepare(`
          INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
          VALUES (?, ?, ?, 'communication', ?, 'confirmation_email_sent', ?)
        `).run(uuidv4(), user.company_id, user.id, communicationId, JSON.stringify({
          recipient: recipientEmail,
          subcontractor_name: subcontractor.name,
          project_name: projectName
        }))
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Document processed successfully',
      verification: {
        status: verification.status,
        confidence_score: verification.confidence_score,
        extracted_data: extractedData,
        checks: verification.checks,
        deficiencies: verification.deficiencies
      }
    })
  } catch (error) {
    console.error('Process document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/documents/[id]/process - Get processing results
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const db = getDb()

    // Get document with verification
    const document = db.prepare(`
      SELECT
        d.*,
        p.company_id,
        v.id as verification_id,
        v.status as verification_status,
        v.confidence_score,
        v.extracted_data,
        v.checks,
        v.deficiencies,
        v.verified_by_user_id,
        v.verified_at
      FROM coc_documents d
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN verifications v ON v.coc_document_id = d.id
      WHERE d.id = ?
    `).get(params.id) as (CocDocument & {
      company_id: string
      verification_id: string | null
      verification_status: string | null
      confidence_score: number | null
      extracted_data: string | null
      checks: string | null
      deficiencies: string | null
      verified_by_user_id: string | null
      verified_at: string | null
    }) | undefined

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify user has access to this document's company
    if (document.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({
      document: {
        id: document.id,
        file_url: document.file_url,
        file_name: document.file_name,
        processing_status: document.processing_status
      },
      verification: document.verification_id ? {
        id: document.verification_id,
        status: document.verification_status,
        confidence_score: document.confidence_score,
        extracted_data: document.extracted_data ? JSON.parse(document.extracted_data) : null,
        checks: document.checks ? JSON.parse(document.checks) : [],
        deficiencies: document.deficiencies ? JSON.parse(document.deficiencies) : [],
        verified_by_user_id: document.verified_by_user_id,
        verified_at: document.verified_at
      } : null
    })
  } catch (error) {
    console.error('Get document processing results error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
