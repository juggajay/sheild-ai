import sgMail from '@sendgrid/mail'

// Types for SendGrid integration
export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  cc?: string[]
  replyTo?: string
  trackingSettings?: {
    clickTracking?: boolean
    openTracking?: boolean
  }
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

// Initialize SendGrid with API key
let initialized = false

function initializeSendGrid(): boolean {
  if (initialized) return true

  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) {
    console.warn('[SendGrid] API key not configured')
    return false
  }

  sgMail.setApiKey(apiKey)
  initialized = true
  return true
}

/**
 * Get the configured from email address
 */
export function getFromEmail(): string {
  return process.env.SENDGRID_FROM_EMAIL || 'noreply@riskshield.ai'
}

/**
 * Get the from name for emails
 */
export function getFromName(): string {
  return process.env.SENDGRID_FROM_NAME || 'RiskShield AI'
}

/**
 * Check if SendGrid is configured and ready
 */
export function isSendGridConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY
}

/**
 * Render an email template by replacing placeholders with actual values
 * Placeholders are in the format {{placeholder_name}}
 */
export function renderTemplate(template: string, data: TemplateData): string {
  let rendered = template

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      rendered = rendered.replace(placeholder, String(value))
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
 * Send an email via SendGrid
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  // Check for dev mode simulation
  const apiKey = process.env.SENDGRID_API_KEY
  if (process.env.NODE_ENV === 'development' && (!apiKey || apiKey === 'test' || apiKey === 'dev')) {
    console.log('[SendGrid DEV] Would send email:', {
      to: options.to,
      subject: options.subject,
      cc: options.cc
    })
    return {
      success: true,
      messageId: `dev-${Date.now()}`
    }
  }

  // Initialize SendGrid
  if (!initializeSendGrid()) {
    return {
      success: false,
      error: 'SendGrid API key not configured'
    }
  }

  try {
    const msg: sgMail.MailDataRequired = {
      to: options.to,
      from: {
        email: getFromEmail(),
        name: getFromName()
      },
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for plain text version
    }

    // Add CC recipients if provided
    if (options.cc && options.cc.length > 0) {
      msg.cc = options.cc
    }

    // Add reply-to if provided
    if (options.replyTo) {
      msg.replyTo = options.replyTo
    }

    // Configure tracking settings
    msg.trackingSettings = {
      clickTracking: {
        enable: options.trackingSettings?.clickTracking !== false
      },
      openTracking: {
        enable: options.trackingSettings?.openTracking !== false
      }
    }

    const [response] = await sgMail.send(msg)

    // Extract message ID from headers
    const messageId = response.headers['x-message-id'] as string | undefined

    console.log('[SendGrid] Email sent successfully:', {
      to: options.to,
      subject: options.subject,
      messageId,
      statusCode: response.statusCode
    })

    return {
      success: true,
      messageId
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[SendGrid] Failed to send email:', errorMessage)

    // Log more details if it's a SendGrid error
    if (error && typeof error === 'object' && 'response' in error) {
      const sgError = error as { response?: { body?: unknown } }
      console.error('[SendGrid] Error details:', sgError.response?.body)
    }

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

  // Use custom template or default
  const subject = templateSubject
    ? renderTemplate(templateSubject, data)
    : `Certificate of Currency Deficiency Notice - ${subcontractorName} / ${projectName}`

  const body = templateBody
    ? renderTemplate(templateBody, data)
    : `Dear ${recipientName},

We have reviewed the Certificate of Currency submitted for ${subcontractorName} (ABN: ${subcontractorAbn}) and found the following compliance issues for the ${projectName} project:

DEFICIENCIES FOUND:
${deficiencyList}

ACTION REQUIRED:
Please provide an updated Certificate of Currency that addresses the above deficiencies by ${data.due_date}.

If you have any questions or need clarification on the requirements, please don't hesitate to contact us.

Best regards,
RiskShield AI Compliance Team`

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

  const subject = `${isUrgent ? 'URGENT: ' : ''}Certificate Expiring Soon - ${subcontractorName} / ${projectName}`

  const body = `Dear ${recipientName},

This is a reminder that the Certificate of Currency for ${subcontractorName} (ABN: ${subcontractorAbn}) will expire on ${expiryDate}.

PROJECT: ${projectName}
DAYS UNTIL EXPIRY: ${daysUntilExpiry}

ACTION REQUIRED:
Please provide an updated Certificate of Currency before the expiration date to maintain compliance.

${uploadLink ? `You can upload the updated certificate here: ${uploadLink}\n\n` : ''}If you have any questions, please contact us.

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
    ? requirements.map(r => `  • ${r}`).join('\n')
    : '  • Current Certificate of Currency\n  • Valid Public Liability coverage\n  • Workers Compensation coverage'

  const body = `Dear ${recipientName || 'Subcontractor'},

${builderName} has added ${subcontractorName} (ABN: ${subcontractorAbn}) to their project and requires your Certificate of Currency before work can commence on site.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROJECT DETAILS
───────────────
Project: ${projectName}
Builder: ${builderName}
${onSiteDate ? `On-Site Date: ${onSiteDate}` : 'On-Site Date: To be confirmed'}

WHAT'S NEEDED
─────────────
${requirementsList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
      content: "✓ ";
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

    <p>Dear ${recipientName || 'Subcontractor'},</p>

    <p><strong>${builderName}</strong> has added <strong>${subcontractorName}</strong> to their project and requires your Certificate of Currency before work can commence.</p>

    <div class="section">
      <div class="section-title">Project Details</div>
      <div class="section-content">
        <strong>Project:</strong> ${projectName}<br>
        <strong>Builder:</strong> ${builderName}<br>
        <strong>On-Site Date:</strong> ${onSiteDate || 'To be confirmed'}
      </div>
    </div>

    <div class="section">
      <div class="section-title">What's Needed</div>
      <ul class="requirements">
        ${requirements && requirements.length > 0
          ? requirements.map(r => `<li>${r}</li>`).join('')
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
      <p>Questions? Contact ${builderName} directly for assistance.</p>
    </div>
  </div>
</body>
</html>`

  // In dev mode, log the invitation link to console
  if (process.env.NODE_ENV === 'development') {
    console.log('\n════════════════════════════════════════════════════════════')
    console.log('📧 INVITATION EMAIL (Dev Mode - Not Actually Sent)')
    console.log('════════════════════════════════════════════════════════════')
    console.log(`To: ${recipientEmail}`)
    console.log(`Subject: ${subject}`)
    console.log(`Project: ${projectName}`)
    console.log(`Builder: ${builderName}`)
    console.log('')
    console.log('🔗 INVITATION LINK:')
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
