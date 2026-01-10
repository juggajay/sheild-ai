import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Default templates for reset functionality
const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  deficiency: {
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
  confirmation: {
    subject: 'Insurance Compliance Confirmed - {{subcontractor_name}} / {{project_name}}',
    body: `Dear {{recipient_name}},

Great news! The Certificate of Currency submitted for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) has been verified and meets all requirements for the {{project_name}} project.

VERIFICATION RESULT: APPROVED

{{subcontractor_name}} is now approved to work on the {{project_name}} project. All insurance coverage requirements have been met.

Thank you for ensuring compliance with our insurance requirements. If you have any questions or need to update your certificate in the future, please don't hesitate to contact us.

Best regards,
RiskShield AI Compliance Team`
  },
  expiration_reminder: {
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
  follow_up_1: {
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
  follow_up_2: {
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
  follow_up_3: {
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
}

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

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    // Get templates for this company (or initialize defaults)
    let templates = await convex.query(api.emailTemplates.listByCompanyWithDefaults, {
      companyId: user.company_id as Id<"companies">,
    })

    // If no templates exist, initialize them
    if (templates.length === 0) {
      await convex.mutation(api.emailTemplates.initializeDefaults, {
        companyId: user.company_id as Id<"companies">,
      })

      // Refetch after initialization
      templates = await convex.query(api.emailTemplates.listByCompanyWithDefaults, {
        companyId: user.company_id as Id<"companies">,
      })
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

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const body = await request.json()
    const { id, subject, body: templateBody } = body

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    const updatedTemplate = await convex.mutation(api.emailTemplates.updateWithVerification, {
      id: id as Id<"emailTemplates">,
      companyId: user.company_id as Id<"companies">,
      subject,
      body: templateBody,
    })

    // Convert to legacy format
    const template = {
      id: updatedTemplate?._id,
      company_id: updatedTemplate?.companyId || null,
      type: updatedTemplate?.type,
      name: updatedTemplate?.name || null,
      subject: updatedTemplate?.subject || null,
      body: updatedTemplate?.body || null,
      is_default: updatedTemplate?.isDefault ? 1 : 0,
      created_at: updatedTemplate?._creationTime ? new Date(updatedTemplate._creationTime).toISOString() : null,
      updated_at: updatedTemplate?.updatedAt ? new Date(updatedTemplate.updatedAt).toISOString() : null,
    }

    return NextResponse.json({ template })
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

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const body = await request.json()
    const { id, type } = body

    // Find the default template for this type
    const defaultTemplate = DEFAULT_TEMPLATES[type]
    if (!defaultTemplate) {
      return NextResponse.json({ error: 'No default template found for this type' }, { status: 404 })
    }

    // Update the template back to default
    const updatedTemplate = await convex.mutation(api.emailTemplates.updateWithVerification, {
      id: id as Id<"emailTemplates">,
      companyId: user.company_id as Id<"companies">,
      subject: defaultTemplate.subject,
      body: defaultTemplate.body,
    })

    // Convert to legacy format
    const template = {
      id: updatedTemplate?._id,
      company_id: updatedTemplate?.companyId || null,
      type: updatedTemplate?.type,
      name: updatedTemplate?.name || null,
      subject: updatedTemplate?.subject || null,
      body: updatedTemplate?.body || null,
      is_default: updatedTemplate?.isDefault ? 1 : 0,
      created_at: updatedTemplate?._creationTime ? new Date(updatedTemplate._creationTime).toISOString() : null,
      updated_at: updatedTemplate?.updatedAt ? new Date(updatedTemplate.updatedAt).toISOString() : null,
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Reset email template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
