import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'
import { downloadFile } from '@/lib/storage'
import { extractDocumentData, convertToLegacyFormat, shouldSkipFraudDetection } from '@/lib/gemini'

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

interface InsuranceRequirement {
  coverageType: string
  minimumLimit: number | null
  maximumExcess: number | null
  principalIndemnityRequired: boolean
  crossLiabilityRequired: boolean
}

// Verify extracted data against project requirements
function verifyAgainstRequirements(
  extractedData: ExtractedData,
  requirements: InsuranceRequirement[],
  projectEndDate?: number | null,
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
      const projectEndStr = projectEnd.toISOString().split('T')[0]
      checks.push({
        check_type: 'project_coverage',
        description: 'Project period coverage',
        status: 'fail',
        details: `Policy expires before project end date (${projectEndStr})`
      })
      deficiencies.push({
        type: 'policy_expires_before_project',
        severity: 'critical',
        description: 'Policy expires before project completion date',
        required_value: `Valid until ${projectEndStr}`,
        actual_value: `Expires ${extractedData.period_of_insurance_end}`
      })
    } else {
      const projectEndStr = projectEnd.toISOString().split('T')[0]
      checks.push({
        check_type: 'project_coverage',
        description: 'Project period coverage',
        status: 'pass',
        details: `Policy covers project period (ends ${projectEndStr})`
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

// Apply template variables to subject and body
function applyTemplateVariables(
  template: { subject: string | null | undefined; body: string | null | undefined },
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
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: documentId } = await params

    // Get document with details for processing
    const docData = await convex.query(api.verifications.getDocumentForProcessing, {
      documentId: documentId as Id<"cocDocuments">,
      companyId: user.companyId,
    })

    if (!docData) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const { document, project, subcontractor, verification: existingVerification, requirements } = docData

    // Update processing status to processing
    await convex.mutation(api.documents.updateProcessingStatus, {
      id: documentId as Id<"cocDocuments">,
      processingStatus: 'processing',
    })

    // Download the document file from storage
    const storagePath = document.fileUrl.includes('/uploads/')
      ? document.fileUrl.split('/uploads/')[1]
      : document.fileUrl
    const downloadResult = await downloadFile(storagePath)

    if (!downloadResult.success || !downloadResult.buffer) {
      // Update document status to failed
      await convex.mutation(api.documents.updateProcessingStatus, {
        id: documentId as Id<"cocDocuments">,
        processingStatus: 'failed',
      })

      return NextResponse.json({
        success: false,
        status: 'extraction_failed',
        error: {
          code: 'UNREADABLE',
          message: 'Could not download the document file. Please upload again.',
          actions: ['upload_new']
        }
      }, { status: 422 })
    }

    // Detect content type
    const contentType = downloadResult.contentType ||
      (document.fileName?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')

    // Extract policy details using Gemini
    const extractionResult = await extractDocumentData(
      downloadResult.buffer,
      contentType,
      document.fileName || 'document'
    )

    // Handle extraction failure
    if (!extractionResult.success || !extractionResult.data) {
      // Update document status to failed
      await convex.mutation(api.documents.updateProcessingStatus, {
        id: documentId as Id<"cocDocuments">,
        processingStatus: 'failed',
      })

      // Update verification record with failure if it exists
      if (existingVerification) {
        await convex.mutation(api.verifications.update, {
          id: existingVerification.id as Id<"verifications">,
          status: 'fail',
          extractedData: { extraction_error: extractionResult.error },
        })
      }

      return NextResponse.json({
        success: false,
        status: 'extraction_failed',
        error: {
          code: extractionResult.error?.code || 'UNREADABLE',
          message: extractionResult.error?.message || "We couldn't read your document. Please ensure it's a clear PDF or image of your Certificate of Currency.",
          actions: extractionResult.error?.retryable ? ['retry', 'upload_new'] : ['upload_new']
        }
      }, { status: 422 })
    }

    // Convert Gemini extraction to legacy format for verification
    const extractedData = convertToLegacyFormat(extractionResult.data, {
      name: subcontractor?.name || 'Unknown',
      abn: subcontractor?.abn || '',
    })
    extractedData.extraction_confidence = extractionResult.confidence

    // Convert requirements to the format expected by verifyAgainstRequirements
    const formattedRequirements: InsuranceRequirement[] = requirements.map(r => ({
      coverageType: r.coverageType,
      minimumLimit: r.minimumLimit || null,
      maximumExcess: r.maximumExcess || null,
      principalIndemnityRequired: r.principalIndemnityRequired || false,
      crossLiabilityRequired: r.crossLiabilityRequired || false,
    }))

    // Verify against requirements (including project end date and state checks)
    const verification = verifyAgainstRequirements(
      extractedData as unknown as ExtractedData,
      formattedRequirements,
      project.endDate,
      project.state
    )

    // Update or create verification record using upsert
    await convex.mutation(api.verifications.upsert, {
      cocDocumentId: documentId as Id<"cocDocuments">,
      projectId: project.id as Id<"projects">,
      status: verification.status,
      confidenceScore: verification.confidence_score,
      extractedData: extractedData,
      checks: verification.checks,
      deficiencies: verification.deficiencies,
    })

    // Update document processing status to completed
    await convex.mutation(api.documents.updateProcessingStatus, {
      id: documentId as Id<"cocDocuments">,
      processingStatus: 'completed',
      processedAt: Date.now(),
    })

    // Log the processing action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.companyId,
      userId: user._id,
      entityType: 'coc_document',
      entityId: documentId,
      action: 'ai_process',
      details: {
        verification_status: verification.status,
        confidence_score: verification.confidence_score,
        checks_count: verification.checks.length,
        deficiencies_count: verification.deficiencies.length
      }
    })

    // If verification failed, auto-send deficiency notification email to broker
    if (verification.status === 'fail' && verification.deficiencies.length > 0 && subcontractor) {
      const recipientEmail = subcontractor.brokerEmail || subcontractor.contactEmail
      const recipientName = subcontractor.brokerName || subcontractor.contactName || 'Insurance Contact'

      if (recipientEmail) {
        // Generate the upload link for the subcontractor portal
        const uploadLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/upload?subcontractor=${document.subcontractorId}&project=${document.projectId}`

        // Format deficiencies for email
        const deficiencyList = verification.deficiencies.map((d: { description: string; severity: string; required_value: string | null; actual_value: string | null }) =>
          `• ${d.description}\n  Severity: ${d.severity.toUpperCase()}\n  Required: ${d.required_value || 'N/A'}\n  Actual: ${d.actual_value || 'N/A'}`
        ).join('\n\n')

        // Calculate due date (14 days from now)
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 14)
        const dueDateStr = dueDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

        // Try to get custom template, fall back to default
        const template = await convex.query(api.emailTemplates.getByCompanyAndType, {
          companyId: user.companyId,
          type: 'deficiency',
        })

        let emailSubject: string
        let emailBody: string

        if (template && template.subject && template.body) {
          // Use custom template with variable substitution
          const result = applyTemplateVariables({ subject: template.subject, body: template.body }, {
            subcontractor_name: subcontractor.name,
            subcontractor_abn: subcontractor.abn,
            project_name: project.name,
            recipient_name: recipientName,
            deficiency_list: deficiencyList,
            upload_link: uploadLink,
            due_date: dueDateStr
          })
          emailSubject = result.subject
          emailBody = result.body
        } else {
          // Fallback to hardcoded default
          emailSubject = `Certificate of Currency Deficiency Notice - ${subcontractor.name} / ${project.name}`
          emailBody = `Dear ${recipientName},

We have identified deficiencies in the Certificate of Currency submitted for ${subcontractor.name} (ABN: ${subcontractor.abn}) on the ${project.name} project.

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

        // Get verification ID
        const newVerification = await convex.query(api.verifications.getByDocument, {
          cocDocumentId: documentId as Id<"cocDocuments">,
        })

        // Queue the deficiency email
        await convex.mutation(api.communications.create, {
          subcontractorId: document.subcontractorId as Id<"subcontractors">,
          projectId: document.projectId as Id<"projects">,
          verificationId: newVerification?._id,
          type: 'deficiency',
          channel: 'email',
          recipientEmail: recipientEmail,
          subject: emailSubject,
          body: emailBody,
          status: 'sent',
        })

        // Log the email action
        await convex.mutation(api.auditLogs.create, {
          companyId: user.companyId,
          userId: user._id,
          entityType: 'communication',
          entityId: 'deficiency_email',
          action: 'deficiency_email_sent',
          details: {
            recipient: recipientEmail,
            subcontractor_name: subcontractor.name,
            project_name: project.name,
            deficiency_count: verification.deficiencies.length
          }
        })
      }
    }

    // If verification passed, send confirmation email and update status
    if (verification.status === 'pass' && subcontractor) {
      const recipientEmail = subcontractor.brokerEmail || subcontractor.contactEmail
      const recipientName = subcontractor.brokerName || subcontractor.contactName || 'Insurance Contact'

      if (recipientEmail) {
        // Try to get custom confirmation template
        const template = await convex.query(api.emailTemplates.getByCompanyAndType, {
          companyId: user.companyId,
          type: 'confirmation',
        })

        let emailSubject: string
        let emailBody: string

        if (template && template.subject && template.body) {
          // Use custom template with variable substitution
          const result = applyTemplateVariables({ subject: template.subject, body: template.body }, {
            subcontractor_name: subcontractor.name,
            subcontractor_abn: subcontractor.abn,
            project_name: project.name,
            recipient_name: recipientName
          })
          emailSubject = result.subject
          emailBody = result.body
        } else {
          // Fallback to hardcoded default
          emailSubject = `Insurance Compliance Confirmed - ${subcontractor.name} / ${project.name}`
          emailBody = `Dear ${recipientName},

Great news! The Certificate of Currency submitted for ${subcontractor.name} (ABN: ${subcontractor.abn}) has been verified and meets all requirements for the ${project.name} project.

VERIFICATION RESULT: APPROVED

${subcontractor.name} is now approved to work on the ${project.name} project. All insurance coverage requirements have been met.

Thank you for ensuring compliance with our insurance requirements. If you have any questions or need to update your certificate in the future, please don't hesitate to contact us.

Best regards,
RiskShield AI Compliance Team`
        }

        // Get verification ID
        const newVerification = await convex.query(api.verifications.getByDocument, {
          cocDocumentId: documentId as Id<"cocDocuments">,
        })

        // Queue the confirmation email
        await convex.mutation(api.communications.create, {
          subcontractorId: document.subcontractorId as Id<"subcontractors">,
          projectId: document.projectId as Id<"projects">,
          verificationId: newVerification?._id,
          type: 'confirmation',
          channel: 'email',
          recipientEmail: recipientEmail,
          subject: emailSubject,
          body: emailBody,
          status: 'sent',
        })

        // Log the email action
        await convex.mutation(api.auditLogs.create, {
          companyId: user.companyId,
          userId: user._id,
          entityType: 'communication',
          entityId: 'confirmation_email',
          action: 'confirmation_email_sent',
          details: {
            recipient: recipientEmail,
            subcontractor_name: subcontractor.name,
            project_name: project.name
          }
        })
      }

      // Auto-resolve any active exceptions for this project/subcontractor
      const resolveResult = await convex.mutation(api.exceptions.resolveActiveByProjectAndSubcontractor, {
        projectId: document.projectId as Id<"projects">,
        subcontractorId: document.subcontractorId as Id<"subcontractors">,
        resolutionType: 'coc_updated',
        resolutionNotes: 'Automatically resolved - new compliant COC uploaded',
      })

      // Log exception resolutions
      if (resolveResult.resolved > 0) {
        await convex.mutation(api.auditLogs.create, {
          companyId: user.companyId,
          userId: user._id,
          entityType: 'exception',
          entityId: 'auto_resolve',
          action: 'auto_resolve',
          details: {
            resolution_type: 'coc_updated',
            document_id: documentId,
            exceptions_resolved: resolveResult.resolved
          }
        })
      }

      // Update project_subcontractor status to 'compliant'
      await convex.mutation(api.projectSubcontractors.updateStatusByProjectAndSubcontractor, {
        projectId: document.projectId as Id<"projects">,
        subcontractorId: document.subcontractorId as Id<"subcontractors">,
        status: 'compliant',
      })

      // Log the status change if exceptions were resolved
      if (resolveResult.resolved > 0) {
        await convex.mutation(api.auditLogs.create, {
          companyId: user.companyId,
          userId: user._id,
          entityType: 'project_subcontractor',
          entityId: `${document.projectId}_${document.subcontractorId}`,
          action: 'status_change',
          details: {
            previous_status: 'exception',
            new_status: 'compliant',
            reason: 'Exceptions auto-resolved after compliant COC upload',
            exceptions_resolved: resolveResult.resolved
          }
        })
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
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: documentId } = await params

    // Get document with details
    const document = await convex.query(api.documents.getByIdForCompany, {
      id: documentId as Id<"cocDocuments">,
      companyId: user.companyId,
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({
      document: {
        id: document._id,
        file_url: document.fileUrl,
        file_name: document.fileName,
        processing_status: document.processingStatus
      },
      verification: document.verification_id ? {
        id: document.verification_id,
        status: document.verification_status,
        confidence_score: document.confidence_score,
        extracted_data: document.extracted_data,
        checks: document.checks || [],
        deficiencies: document.deficiencies || [],
        verified_by_user_id: document.verified_by_user_id,
        verified_at: document.verified_at
      } : null
    })
  } catch (error) {
    console.error('Get document processing results error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
