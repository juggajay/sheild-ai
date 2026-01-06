import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

interface EmailTemplate {
  id: string
  company_id: string | null
  type: string
  name: string | null
  subject: string | null
  body: string | null
  is_default: number
  created_at: string
  updated_at: string
}

// Default templates for initialization
const DEFAULT_TEMPLATES = [
  {
    type: 'deficiency',
    name: 'Deficiency Notice',
    subject: 'Certificate of Currency Deficiency Notice - {{subcontractor_name}} / {{project_name}}',
    body: `Dear {{recipient_name}},

We have reviewed the Certificate of Currency submitted for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) and found the following compliance issues for the {{project_name}} project:

DEFICIENCIES FOUND:
{{deficiency_list}}

ACTION REQUIRED:
Please provide an updated Certificate of Currency that addresses the above deficiencies by {{due_date}}.

You can upload the updated certificate here: {{upload_link}}

If you have any questions or need clarification on the requirements, please don't hesitate to contact us.

Best regards,
RiskShield AI Compliance Team`
  },
  {
    type: 'confirmation',
    name: 'Compliance Confirmed',
    subject: 'Insurance Compliance Confirmed - {{subcontractor_name}} / {{project_name}}',
    body: `Dear {{recipient_name}},

Great news! The Certificate of Currency submitted for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) has been verified and meets all requirements for the {{project_name}} project.

VERIFICATION RESULT: APPROVED

{{subcontractor_name}} is now approved to work on the {{project_name}} project. All insurance coverage requirements have been met.

Thank you for ensuring compliance with our insurance requirements. If you have any questions or need to update your certificate in the future, please don't hesitate to contact us.

Best regards,
RiskShield AI Compliance Team`
  },
  {
    type: 'expiration_reminder',
    name: 'Expiration Reminder',
    subject: 'Certificate Expiring Soon - {{subcontractor_name}} / {{project_name}}',
    body: `Dear {{recipient_name}},

This is a reminder that the Certificate of Currency for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) will expire on {{expiry_date}}.

PROJECT: {{project_name}}
DAYS UNTIL EXPIRY: {{days_until_expiry}}

ACTION REQUIRED:
Please provide an updated Certificate of Currency before the expiration date to maintain compliance.

You can upload the updated certificate here: {{upload_link}}

If you have any questions, please contact us.

Best regards,
RiskShield AI Compliance Team`
  },
  {
    type: 'follow_up_1',
    name: 'First Follow-up',
    subject: 'REMINDER: Certificate of Currency Required - {{subcontractor_name}} / {{project_name}}',
    body: `Dear {{recipient_name}},

This is a friendly reminder regarding the outstanding Certificate of Currency for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) for the {{project_name}} project.

OUTSTANDING ISSUES:
{{deficiency_list}}

Please provide the required documentation as soon as possible to maintain compliance.

Upload link: {{upload_link}}

Best regards,
RiskShield AI Compliance Team`
  },
  {
    type: 'follow_up_2',
    name: 'Second Follow-up',
    subject: 'URGENT: Certificate of Currency Still Required - {{subcontractor_name}} / {{project_name}}',
    body: `Dear {{recipient_name}},

This is an urgent reminder that we still haven't received an updated Certificate of Currency for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) for the {{project_name}} project.

OUTSTANDING ISSUES:
{{deficiency_list}}

Please address this matter immediately to avoid any impact on site access.

Upload link: {{upload_link}}

Best regards,
RiskShield AI Compliance Team`
  },
  {
    type: 'follow_up_3',
    name: 'Final Notice',
    subject: 'FINAL NOTICE: Certificate of Currency Required - {{subcontractor_name}} / {{project_name}}',
    body: `Dear {{recipient_name}},

FINAL NOTICE

Despite multiple reminders, we have not received an updated Certificate of Currency for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) for the {{project_name}} project.

OUTSTANDING ISSUES:
{{deficiency_list}}

This matter requires immediate attention. Failure to provide compliant documentation may result in restricted site access.

Upload link: {{upload_link}}

Best regards,
RiskShield AI Compliance Team`
  }
]

// GET /api/email-templates - List all email templates
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

    const db = getDb()

    // Get templates for this company (or system defaults)
    const templates = db.prepare(`
      SELECT * FROM email_templates
      WHERE company_id = ? OR (company_id IS NULL AND is_default = 1)
      ORDER BY type, is_default DESC
    `).all(user.company_id) as EmailTemplate[]

    // If no custom templates exist, return defaults
    if (templates.length === 0) {
      // Initialize with default templates
      const insertStmt = db.prepare(`
        INSERT INTO email_templates (id, company_id, type, name, subject, body, is_default)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `)

      const insertedTemplates: EmailTemplate[] = []
      for (const template of DEFAULT_TEMPLATES) {
        const id = uuidv4()
        insertStmt.run(id, user.company_id, template.type, template.name, template.subject, template.body)
        insertedTemplates.push({
          id,
          company_id: user.company_id,
          type: template.type,
          name: template.name,
          subject: template.subject,
          body: template.body,
          is_default: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
      return NextResponse.json({ templates: insertedTemplates })
    }

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Get email templates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/email-templates - Update a template
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admins and risk managers can edit templates
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { id, subject, body: templateBody } = body

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    const db = getDb()

    // Verify template belongs to this company
    const template = db.prepare(`
      SELECT * FROM email_templates WHERE id = ? AND company_id = ?
    `).get(id, user.company_id) as EmailTemplate | undefined

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Update the template
    db.prepare(`
      UPDATE email_templates
      SET subject = ?, body = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(subject, templateBody, id)

    const updatedTemplate = db.prepare(`SELECT * FROM email_templates WHERE id = ?`).get(id)

    return NextResponse.json({ template: updatedTemplate })
  } catch (error) {
    console.error('Update email template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/email-templates/reset - Reset a template to default
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

    // Only admins and risk managers can reset templates
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { id, type } = body

    const db = getDb()

    // Find the default template for this type
    const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.type === type)
    if (!defaultTemplate) {
      return NextResponse.json({ error: 'No default template found for this type' }, { status: 404 })
    }

    // Update the template back to default
    db.prepare(`
      UPDATE email_templates
      SET subject = ?, body = ?, updated_at = datetime('now')
      WHERE id = ? AND company_id = ?
    `).run(defaultTemplate.subject, defaultTemplate.body, id, user.company_id)

    const updatedTemplate = db.prepare(`SELECT * FROM email_templates WHERE id = ?`).get(id)

    return NextResponse.json({ template: updatedTemplate })
  } catch (error) {
    console.error('Reset email template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
