import { Resend } from 'resend'

/**
 * HTML-escape a string to prevent XSS attacks in email templates
 * Escapes: & < > " ' to their HTML entity equivalents
 */
export function escapeHtml(unsafe: string | undefined | null): string {
  if (unsafe === undefined || unsafe === null) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Types for email integration
export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  cc?: string[]
  replyTo?: string
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface TemplateData {
  recipient_name?: string
  subcontractor_name?: string
  subcontractor_abn?: string
  project_name?: string
  deficiency_list?: string
  due_date?: string
  upload_link?: string
  expiry_date?: string
  days_until_expiry?: string | number
  [key: string]: string | number | undefined
}

// Initialize Resend client
let resendClient: Resend | null = null

function getResendClient(): Resend | null {
  if (resendClient) return resendClient

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Resend] API key not configured')
    return null
  }

  resendClient = new Resend(apiKey)
  return resendClient
}

/**
 * Get the configured from email address
 */
export function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'noreply@riskshield.ai'
}

/**
 * Get the from name for emails
 */
export function getFromName(): string {
  return process.env.RESEND_FROM_NAME || 'RiskShield AI'
}

/**
 * Check if Resend is configured and ready
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

// Backwards compatibility alias
export const isSendGridConfigured = isEmailConfigured

/**
 * Render an email template by replacing placeholders with actual values
 * Placeholders are in the format {{placeholder_name}}
 */
export function renderTemplate(template: string, data: TemplateData, escapeValues = true): string {
  let rendered = template

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      // Security: Escape HTML by default to prevent XSS
      const safeValue = escapeValues ? escapeHtml(String(value)) : String(value)
      rendered = rendered.replace(placeholder, safeValue)
    }
  }

  return rendered
}

/**
 * Convert plain text email body to basic HTML
 */
export function textToHtml(text: string): string {
  // Escape HTML entities
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Convert line breaks to <br> and paragraphs
  const withBreaks = escaped
    .split('\n\n')
    .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')

  // Wrap in basic HTML template
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        p {
          margin: 0 0 16px 0;
        }
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e5e5e5;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      ${withBreaks}
      <div class="footer">
        <p>This email was sent by RiskShield AI - Insurance Compliance Management</p>
      </div>
    </body>
    </html>
  `
}

/**
 * Send an email via Resend
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY

  // Check for dev mode simulation
  if (process.env.NODE_ENV === 'development' && (!apiKey || apiKey === 'test' || apiKey === 'dev')) {
    console.log('[Resend DEV] Would send email:', {
      to: options.to,
      subject: options.subject,
      cc: options.cc
    })
    return {
      success: true,
      messageId: `dev-${Date.now()}`
    }
  }

  const client = getResendClient()
  if (!client) {
    return {
      success: false,
      error: 'Resend API key not configured'
    }
  }

  try {
    const fromAddress = `${getFromName()} <${getFromEmail()}>`

    const { data, error } = await client.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
      cc: options.cc,
      replyTo: options.replyTo,
    })

    if (error) {
      console.error('[Resend] Failed to send email:', error)
      return {
        success: false,
        error: error.message
      }
    }

    console.log('[Resend] Email sent successfully:', {
      to: options.to,
      subject: options.subject,
      messageId: data?.id
    })

    return {
      success: true,
      messageId: data?.id
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Resend] Failed to send email:', errorMessage)

    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Send a deficiency notification email
 */
export async function sendDeficiencyEmail(params: {
  recipientEmail: string
  recipientName: string
  ccEmails?: string[]
  subcontractorName: string
  subcontractorAbn: string
  projectName: string
  deficiencies: Array<{ type?: string; description: string; check_name?: string; message?: string }>
  dueDate?: string
  uploadLink?: string
  templateSubject?: string
  templateBody?: string
}): Promise<EmailResult> {
  const {
    recipientEmail,
    recipientName,
    ccEmails,
    subcontractorName,
    subcontractorAbn,
    projectName,
    deficiencies,
    dueDate,
    uploadLink,
    templateSubject,
    templateBody
  } = params

  // Format deficiencies list
  const deficiencyList = deficiencies
    .map(d => {
      const desc = d.description || d.message || 'Unknown issue'
      const type = d.type || d.check_name
      return type ? `- ${type}: ${desc}` : `- ${desc}`
    })
    .join('\n')

  // Template data
  const data: TemplateData = {
    recipient_name: recipientName,
    subcontractor_name: subcontractorName,
    subcontractor_abn: subcontractorAbn,
    project_name: projectName,
    deficiency_list: deficiencyList,
    due_date: dueDate || 'As soon as possible',
    upload_link: uploadLink || process.env.NEXT_PUBLIC_APP_URL || 'https://riskshield.ai'
  }

  // Use custom template or default - written in plain English for tradies
  const subject = templateSubject
    ? renderTemplate(templateSubject, data)
    : `Issue with your insurance certificate for ${projectName}`

  const body = templateBody
    ? renderTemplate(templateBody, data)
    : `Hi ${recipientName},

We've checked the insurance certificate you sent for ${subcontractorName} on the ${projectName} project, and there are some issues that need fixing:

WHAT NEEDS TO BE FIXED:
${deficiencyList}

WHAT TO DO:
1. Contact your insurance broker or provider
2. Get an updated Certificate of Currency that fixes the issues above
3. Send it back to us by ${data.due_date}

If you have any questions, just reply to this email and we'll help.

Thanks,
The Compliance Team`

  return sendEmail({
    to: recipientEmail,
    subject,
    html: textToHtml(body),
    text: body,
    cc: ccEmails
  })
}

/**
 * Send a follow-up email for pending compliance
 */
export async function sendFollowUpEmail(params: {
  recipientEmail: string
  subcontractorName: string
  projectName: string
  deficiencies: Array<{ type?: string; description: string; check_name?: string; message?: string }>
  daysWaiting: number
  uploadLink?: string
}): Promise<EmailResult> {
  const {
    recipientEmail,
    subcontractorName,
    projectName,
    deficiencies,
    daysWaiting,
    uploadLink
  } = params

  const isUrgent = daysWaiting >= 7

  const deficiencyList = deficiencies
    .map(d => {
      const desc = d.description || d.message || 'Unknown issue'
      return `- ${desc}`
    })
    .join('\n')

  const subject = `[Follow-up${isUrgent ? ' URGENT' : ''}] Insurance Certificate Required - ${projectName}`

  const body = `Dear ${subcontractorName},

This is a follow-up regarding your Certificate of Currency for project "${projectName}".

We sent you a notification ${daysWaiting} day${daysWaiting !== 1 ? 's' : ''} ago regarding deficiencies with your submitted insurance certificate. We have not yet received an updated certificate addressing these issues.

${isUrgent ? 'URGENT: Immediate action is required to maintain compliance on this project.\n\n' : ''}Original Issues:
${deficiencyList || 'Please contact us for specific details.'}

Please submit an updated Certificate of Currency as soon as possible to maintain compliance.

${uploadLink ? `Upload your updated certificate here: ${uploadLink}\n\n` : ''}If you have already submitted an updated certificate, please disregard this message.

Thank you for your prompt attention to this matter.

Best regards,
The Compliance Team`

  return sendEmail({
    to: recipientEmail,
    subject,
    html: textToHtml(body),
    text: body
  })
}

/**
 * Deficiency type with required/actual values for plain-English formatting
 */
interface DeficiencyItem {
  type?: string
  description?: string
  message?: string
  check_name?: string
  required_value?: string
  actual_value?: string
  severity?: string
}

/**
 * Format a coverage type into plain English
 */
function formatCoverageTypePlainEnglish(type: string): string {
  const mappings: Record<string, string> = {
    'public_liability': 'Public Liability',
    'professional_indemnity': 'Professional Indemnity',
    'workers_comp': 'Workers Compensation',
    'motor_vehicle': 'Motor Vehicle',
    'contract_works': 'Contract Works',
    'product_liability': 'Product Liability',
  }
  return mappings[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Convert deficiency to plain-English explanation
 */
function formatDeficiencyPlainEnglish(deficiency: DeficiencyItem): string {
  const type = deficiency.type || ''
  const required = deficiency.required_value || ''
  const actual = deficiency.actual_value || ''

  // Handle common deficiency types with plain English
  switch (type) {
    case 'expired_policy':
      return `Your policy has expired${actual ? ` (${actual})` : ''}`

    case 'policy_expires_before_project':
      return `Your policy expires before the project ends - needs to be valid until ${required}`

    case 'insufficient_limit':
      // Extract coverage type from description if available
      const limitMatch = deficiency.description?.match(/^(.*?) limit/i)
      const coverageType = limitMatch ? limitMatch[1] : 'Coverage'
      return `${coverageType} is ${actual} — they require ${required}`

    case 'missing_coverage':
      const coverageMatch = deficiency.description?.match(/^(.*?) coverage/i)
      const missingType = coverageMatch ? coverageMatch[1] : 'Required coverage'
      return `${missingType} coverage is missing from your certificate`

    case 'excess_too_high':
      const excessMatch = deficiency.description?.match(/^(.*?) excess/i)
      const excessType = excessMatch ? excessMatch[1] : 'Coverage'
      return `${excessType} excess is ${actual} — maximum allowed is ${required}`

    case 'abn_mismatch':
      return `The ABN on your certificate doesn't match your registered ABN`

    case 'unlicensed_insurer':
      return `Your insurer needs to be APRA-licensed in Australia`

    case 'principal_indemnity_missing':
      return `Your policy needs to include the builder as an interested party`

    case 'cross_liability_missing':
      return `Your policy needs a cross liability clause`

    default:
      // Fallback to description if available, otherwise use type
      if (deficiency.description) {
        // Try to simplify technical language
        let desc = deficiency.description
          .replace(/Principal Indemnity/gi, 'builder as interested party')
          .replace(/Cross Liability/gi, 'cross liability clause')
          .replace(/APRA-licensed/gi, 'Australian-licensed')

        if (required && actual) {
          return `${desc} (you have ${actual}, they need ${required})`
        }
        return desc
      }
      return deficiency.message || 'Issue with your certificate'
  }
}

/**
 * Send a plain-English follow-up email to subcontractor about certificate issues
 * This is designed for subcontractors who may not understand insurance jargon
 */
export async function sendSubcontractorFollowUpEmail(params: {
  recipientEmail: string
  recipientName?: string
  subcontractorName: string
  projectName: string
  builderName: string
  deficiencies: DeficiencyItem[]
  daysWaiting: number
  followUpNumber: number
  uploadLink?: string
  ccEmails?: string[]
}): Promise<EmailResult> {
  const {
    recipientEmail,
    recipientName,
    subcontractorName,
    projectName,
    builderName,
    deficiencies,
    daysWaiting,
    followUpNumber,
    uploadLink,
    ccEmails
  } = params

  const isUrgent = followUpNumber >= 3 || daysWaiting >= 7
  const isFinal = followUpNumber >= 3

  // Format deficiencies in plain English
  const issuesList = deficiencies
    .map(d => `• ${formatDeficiencyPlainEnglish(d)}`)
    .join('\n')

  // Determine urgency level for subject
  let urgencyPrefix = ''
  if (isFinal) {
    urgencyPrefix = '[FINAL NOTICE] '
  } else if (isUrgent) {
    urgencyPrefix = '[Action Required] '
  }

  const subject = `${urgencyPrefix}Insurance certificate issue for ${projectName}`

  // Build the email body in plain English
  const greeting = recipientName ? `Hi ${recipientName}` : `Hi ${subcontractorName}`

  let body = `${greeting},

Your insurance certificate for the ${projectName} project with ${builderName} has ${deficiencies.length === 1 ? 'an issue' : 'some issues'} that need to be fixed:

${issuesList}

`

  if (isFinal) {
    body += `This is our final reminder. We first contacted you ${daysWaiting} days ago about this.

If we don't receive an updated certificate soon, ${builderName} may need to restrict your access to the project until this is resolved.

`
  } else if (followUpNumber === 2) {
    body += `This is a reminder — we first contacted you ${daysWaiting} days ago about this.

`
  }

  body += `WHAT TO DO
----------
1. Contact your insurance broker or provider
2. Get an updated Certificate of Currency that fixes the ${deficiencies.length === 1 ? 'issue above' : 'issues above'}
3. Upload it here: ${uploadLink || 'Contact the builder for upload instructions'}

`

  if (!isFinal) {
    body += `If you've already sent an updated certificate, please ignore this email.

`
  }

  body += `Questions? Reply to this email and we'll help.

Thanks,
${builderName} Compliance Team`

  // Create HTML version with better formatting
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      ${isUrgent ? 'background: #fef3cd; border-left: 4px solid #ffc107;' : 'background: #e7f3ff; border-left: 4px solid #0066cc;'}
      padding: 16px;
      margin-bottom: 24px;
      border-radius: 4px;
    }
    .header h2 {
      margin: 0;
      color: ${isUrgent ? '#856404' : '#004085'};
      font-size: 18px;
    }
    .issues-box {
      background: #fff5f5;
      border: 1px solid #fed7d7;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
    .issues-box h3 {
      margin: 0 0 12px 0;
      color: #c53030;
      font-size: 14px;
      text-transform: uppercase;
    }
    .issue-item {
      padding: 8px 0;
      border-bottom: 1px solid #fed7d7;
      color: #2d3748;
    }
    .issue-item:last-child {
      border-bottom: none;
    }
    .action-box {
      background: #f0fff4;
      border: 1px solid #9ae6b4;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
    .action-box h3 {
      margin: 0 0 12px 0;
      color: #276749;
      font-size: 14px;
      text-transform: uppercase;
    }
    .cta-button {
      display: inline-block;
      background: #0066cc;
      color: white !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 600;
      margin-top: 12px;
    }
    .warning-text {
      color: #c53030;
      font-weight: 600;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #718096;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>${isFinal ? '⚠️ Final Notice: ' : isUrgent ? '⚠️ ' : ''}Insurance certificate issue for ${escapeHtml(projectName)}</h2>
  </div>

  <p>${greeting},</p>

  <p>Your insurance certificate for the <strong>${escapeHtml(projectName)}</strong> project with <strong>${escapeHtml(builderName)}</strong> has ${deficiencies.length === 1 ? 'an issue' : 'some issues'} that need to be fixed:</p>

  <div class="issues-box">
    <h3>Issues Found</h3>
    ${deficiencies.map(d => `<div class="issue-item">${escapeHtml(formatDeficiencyPlainEnglish(d))}</div>`).join('')}
  </div>

  ${isFinal ? `
  <p class="warning-text">This is our final reminder. We first contacted you ${daysWaiting} days ago.</p>
  <p>If we don't receive an updated certificate soon, ${escapeHtml(builderName)} may need to restrict your access to the project until this is resolved.</p>
  ` : followUpNumber === 2 ? `
  <p>This is a reminder — we first contacted you ${daysWaiting} days ago about this.</p>
  ` : ''}

  <div class="action-box">
    <h3>What To Do</h3>
    <ol>
      <li>Contact your insurance broker or provider</li>
      <li>Get an updated Certificate of Currency that fixes the ${deficiencies.length === 1 ? 'issue above' : 'issues above'}</li>
      <li>Upload it using the button below</li>
    </ol>
    ${uploadLink ? `<a href="${uploadLink}" class="cta-button">Upload Updated Certificate</a>` : ''}
  </div>

  ${!isFinal ? `<p style="color: #718096;">If you've already sent an updated certificate, please ignore this email.</p>` : ''}

  <p>Questions? Reply to this email and we'll help.</p>

  <p>Thanks,<br>${escapeHtml(builderName)} Compliance Team</p>

  <div class="footer">
    <p>Powered by RiskShield AI - Automated Insurance Compliance</p>
  </div>
</body>
</html>`

  return sendEmail({
    to: recipientEmail,
    subject,
    html: htmlBody,
    text: body,
    cc: ccEmails
  })
}

/**
 * Send a compliance confirmation email
 */
export async function sendConfirmationEmail(params: {
  recipientEmail: string
  recipientName: string
  subcontractorName: string
  subcontractorAbn: string
  projectName: string
}): Promise<EmailResult> {
  const {
    recipientEmail,
    recipientName,
    subcontractorName,
    subcontractorAbn,
    projectName
  } = params

  const subject = `Insurance Compliance Confirmed - ${subcontractorName} / ${projectName}`

  const body = `Dear ${recipientName},

Great news! The Certificate of Currency submitted for ${subcontractorName} (ABN: ${subcontractorAbn}) has been verified and meets all requirements for the ${projectName} project.

VERIFICATION RESULT: APPROVED

${subcontractorName} is now approved to work on the ${projectName} project. All insurance coverage requirements have been met.

Thank you for ensuring compliance with our insurance requirements. If you have any questions or need to update your certificate in the future, please don't hesitate to contact us.

Best regards,
RiskShield AI Compliance Team`

  return sendEmail({
    to: recipientEmail,
    subject,
    html: textToHtml(body),
    text: body
  })
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(params: {
  recipientEmail: string
  recipientName: string
  resetLink: string
  expiresInMinutes?: number
}): Promise<EmailResult> {
  const {
    recipientEmail,
    recipientName,
    resetLink,
    expiresInMinutes = 60
  } = params

  const subject = 'Reset Your RiskShield AI Password'

  const body = `Dear ${recipientName},

We received a request to reset the password for your RiskShield AI account.

Click the link below to reset your password:
${resetLink}

This link will expire in ${expiresInMinutes} minutes.

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

Best regards,
RiskShield AI Team`

  return sendEmail({
    to: recipientEmail,
    subject,
    html: textToHtml(body),
    text: body
  })
}

/**
 * Send an expiration reminder email
 */
export async function sendExpirationReminderEmail(params: {
  recipientEmail: string
  recipientName: string
  subcontractorName: string
  subcontractorAbn: string
  projectName: string
  expiryDate: string
  daysUntilExpiry: number
  uploadLink?: string
}): Promise<EmailResult> {
  const {
    recipientEmail,
    recipientName,
    subcontractorName,
    subcontractorAbn,
    projectName,
    expiryDate,
    daysUntilExpiry,
    uploadLink
  } = params

  const isUrgent = daysUntilExpiry <= 7

  const subject = `${isUrgent ? 'Urgent: ' : ''}Your insurance certificate expires ${daysUntilExpiry <= 0 ? 'today' : `in ${daysUntilExpiry} days`} - ${projectName}`

  const body = `Hi ${recipientName},

Just a heads up - the insurance certificate for ${subcontractorName} on the ${projectName} project ${daysUntilExpiry <= 0 ? 'has expired' : `expires on ${expiryDate}`}.

${isUrgent ? "This is urgent - you'll need to get a new certificate to keep working on site.\n\n" : ''}WHAT TO DO:
1. Contact your insurance broker or provider
2. Get a new Certificate of Currency
3. Upload it here: ${uploadLink || 'Contact the builder for upload instructions'}

If you've already sent a new certificate, you can ignore this message.

Questions? Just reply to this email.

Thanks,
The Compliance Team`

  return sendEmail({
    to: recipientEmail,
    subject,
    html: textToHtml(body),
    text: body
  })
}

/**
 * Send a portal invitation email to a subcontractor
 */
export async function sendInvitationEmail(params: {
  recipientEmail: string
  recipientName: string
  subcontractorName: string
  subcontractorAbn: string
  projectName: string
  builderName: string
  onSiteDate?: string
  requirements?: string[]
  invitationLink: string
  expiresInDays?: number
}): Promise<EmailResult> {
  const {
    recipientEmail,
    recipientName,
    subcontractorName,
    subcontractorAbn,
    projectName,
    builderName,
    onSiteDate,
    requirements,
    invitationLink,
    expiresInDays = 7
  } = params

  const subject = `Action Required: Upload Certificate of Currency for ${projectName}`

  // Format requirements list
  const requirementsList = requirements && requirements.length > 0
    ? requirements.map(r => `  - ${r}`).join('\n')
    : '  - Current Certificate of Currency\n  - Valid Public Liability coverage\n  - Workers Compensation coverage'

  const body = `Dear ${recipientName || 'Subcontractor'},

${builderName} has added ${subcontractorName} (ABN: ${subcontractorAbn}) to their project and requires your Certificate of Currency before work can commence on site.

PROJECT DETAILS
---------------
Project: ${projectName}
Builder: ${builderName}
${onSiteDate ? `On-Site Date: ${onSiteDate}` : 'On-Site Date: To be confirmed'}

WHAT'S NEEDED
-------------
${requirementsList}

Click the link below to securely upload your certificate:

${invitationLink}

This secure link expires in ${expiresInDays} days. If you need a new link, visit the portal login page and enter your email address.

Questions? Contact ${builderName} directly for assistance.

Best regards,
RiskShield AI Compliance Team`

  // Create HTML version with styled button
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 24px;
      border-bottom: 2px solid #e5e5e5;
      margin-bottom: 24px;
    }
    .header h1 {
      color: #0066cc;
      margin: 0;
      font-size: 24px;
    }
    .section {
      margin: 24px 0;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 6px;
    }
    .section-title {
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section-content {
      color: #555;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0;
    }
    .cta-button {
      display: inline-block;
      background: #0066cc;
      color: white !important;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
    }
    .requirements {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .requirements li {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .requirements li:last-child {
      border-bottom: none;
    }
    .requirements li:before {
      content: "\\2713 ";
      color: #0066cc;
      font-weight: bold;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e5e5;
      font-size: 12px;
      color: #888;
      text-align: center;
    }
    .expiry-note {
      font-size: 13px;
      color: #666;
      text-align: center;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Certificate of Currency Required</h1>
    </div>

    <p>Dear ${escapeHtml(recipientName) || 'Subcontractor'},</p>

    <p><strong>${escapeHtml(builderName)}</strong> has added <strong>${escapeHtml(subcontractorName)}</strong> to their project and requires your Certificate of Currency before work can commence.</p>

    <div class="section">
      <div class="section-title">Project Details</div>
      <div class="section-content">
        <strong>Project:</strong> ${escapeHtml(projectName)}<br>
        <strong>Builder:</strong> ${escapeHtml(builderName)}<br>
        <strong>On-Site Date:</strong> ${escapeHtml(onSiteDate) || 'To be confirmed'}
      </div>
    </div>

    <div class="section">
      <div class="section-title">What's Needed</div>
      <ul class="requirements">
        ${requirements && requirements.length > 0
          ? requirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')
          : '<li>Current Certificate of Currency</li><li>Valid Public Liability coverage</li><li>Workers Compensation coverage</li>'
        }
      </ul>
    </div>

    <div class="cta-container">
      <a href="${invitationLink}" class="cta-button">Upload Your Certificate</a>
    </div>

    <p class="expiry-note">This secure link expires in ${expiresInDays} days.</p>

    <div class="footer">
      <p>RiskShield AI - Automated Insurance Compliance Verification</p>
      <p>Questions? Contact ${escapeHtml(builderName)} directly for assistance.</p>
    </div>
  </div>
</body>
</html>`

  // In dev mode, log the invitation link to console
  if (process.env.NODE_ENV === 'development') {
    console.log('\n════════════════════════════════════════════════════════════')
    console.log('INVITATION EMAIL (Dev Mode - Not Actually Sent)')
    console.log('════════════════════════════════════════════════════════════')
    console.log(`To: ${recipientEmail}`)
    console.log(`Subject: ${subject}`)
    console.log(`Project: ${projectName}`)
    console.log(`Builder: ${builderName}`)
    console.log('')
    console.log('INVITATION LINK:')
    console.log(invitationLink)
    console.log('════════════════════════════════════════════════════════════\n')
  }

  return sendEmail({
    to: recipientEmail,
    subject,
    html: htmlBody,
    text: body
  })
}
