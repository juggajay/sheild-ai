import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { sendFollowUpEmail, isEmailConfigured } from '@/lib/resend'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// POST /api/communications/resend - Resend a follow-up communication for a failed verification
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

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const body = await request.json()
    const { verificationId, subcontractorId, projectId } = body

    if (!verificationId || !subcontractorId || !projectId) {
      return NextResponse.json({ error: 'verificationId, subcontractorId, and projectId are required' }, { status: 400 })
    }

    // Verify project belongs to user's company
    const project = await convex.query(api.projects.getByIdForCompany, {
      id: projectId as Id<"projects">,
      companyId: user.company_id as Id<"companies">,
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get verification info
    const verification = await convex.query(api.verifications.getById, {
      id: verificationId as Id<"verifications">,
    })

    if (!verification) {
      return NextResponse.json({ error: 'Verification not found' }, { status: 404 })
    }

    // Get subcontractor info
    const subcontractor = await convex.query(api.subcontractors.getById, {
      id: subcontractorId as Id<"subcontractors">,
    })

    if (!subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Parse deficiencies for the email
    let rawDeficiencies: Array<{ check_name?: string; message?: string; type?: string; description?: string }> = []
    try {
      if (Array.isArray(verification.deficiencies)) {
        rawDeficiencies = verification.deficiencies as typeof rawDeficiencies
      } else if (typeof verification.deficiencies === 'string') {
        rawDeficiencies = JSON.parse(verification.deficiencies || '[]')
      }
    } catch {
      rawDeficiencies = []
    }

    // Transform deficiencies to match expected type for sendFollowUpEmail
    const deficiencies = rawDeficiencies.map(d => ({
      type: d.type,
      description: d.description || d.message || 'Issue with certificate',
      check_name: d.check_name,
      message: d.message
    }))

    const deficiencyList = rawDeficiencies.map(d => `- ${d.check_name || d.type || 'Issue'}: ${d.message || d.description || 'See details'}`).join('\n')

    const now = Date.now()
    const emailSubject = `Follow-up: Insurance Certificate Required - ${project.name}`
    const emailBody = `Dear ${subcontractor.name},

This is a follow-up regarding your Certificate of Currency for project "${project.name}".

We previously notified you of deficiencies with your submitted insurance certificate. We have not yet received an updated certificate addressing these issues.

Original Issues:
${deficiencyList || 'Please contact us for details.'}

Please submit an updated Certificate of Currency as soon as possible to maintain compliance.

If you have already submitted an updated certificate, please disregard this message.

Thank you for your prompt attention to this matter.

Best regards,
The Compliance Team`

    // Actually send the email via Resend
    let emailStatus: 'sent' | 'pending' | 'failed' = 'sent'
    let emailError: string | undefined

    if (isEmailConfigured() && subcontractor.contactEmail) {
      const emailResult = await sendFollowUpEmail({
        recipientEmail: subcontractor.contactEmail,
        subcontractorName: subcontractor.name,
        projectName: project.name,
        deficiencies,
        daysWaiting: 0, // Manual resend, no specific wait time
        uploadLink: process.env.NEXT_PUBLIC_APP_URL || undefined
      })

      if (!emailResult.success) {
        emailStatus = 'failed'
        emailError = emailResult.error
        console.error('[Resend] Failed to send email:', emailResult.error)
      }
    } else if (!subcontractor.contactEmail) {
      emailStatus = 'failed'
      emailError = 'No contact email available'
    } else {
      console.log('[Resend] Email not configured, recording communication without sending')
    }

    // Create communication record in Convex
    const communicationId = await convex.mutation(api.communications.create, {
      subcontractorId: subcontractorId as Id<"subcontractors">,
      projectId: projectId as Id<"projects">,
      verificationId: verificationId as Id<"verifications">,
      type: 'follow_up',
      channel: 'email',
      recipientEmail: subcontractor.contactEmail || undefined,
      subject: emailSubject,
      body: emailBody,
      status: emailStatus,
      sentAt: emailStatus === 'sent' ? now : undefined,
    })

    // Log the audit entry
    await convex.mutation(api.auditLogs.create, {
      companyId: user.company_id as Id<"companies">,
      userId: user.id as Id<"users">,
      entityType: 'communication',
      entityId: communicationId,
      action: 'resend',
      details: {
        verification_id: verificationId,
        subcontractor_name: subcontractor.name,
        project_name: project.name,
        type: 'follow_up'
      }
    })

    return NextResponse.json({
      success: emailStatus === 'sent',
      message: emailStatus === 'sent' ? 'Follow-up communication sent' : `Failed to send email: ${emailError}`,
      communication: {
        id: communicationId,
        type: 'follow_up',
        status: emailStatus,
        recipient: subcontractor.contactEmail,
        sent_at: emailStatus === 'sent' ? new Date(now).toISOString() : null
      }
    })

  } catch (error) {
    console.error('Resend communication error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
