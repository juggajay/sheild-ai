import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { sendFollowUpEmail, isEmailConfigured } from '@/lib/resend'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// POST /api/communications/trigger-followups - Trigger follow-up emails for pending responses
// In production this would run as a scheduled job, this endpoint is for manual triggering/testing
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

    // Only admin and risk_manager can trigger follow-ups
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins and risk managers can trigger follow-ups' }, { status: 403 })
    }

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const { minDaysWaiting = 2, maxFollowups = 10 } = body

    // Get pending follow-ups from Convex
    const pendingResponses = await convex.query(api.dashboard.getPendingFollowups, {
      companyId: user.company_id as Id<"companies">,
      minDaysWaiting,
      maxFollowups,
    })

    const followupsSent: Array<{
      communicationId: string
      subcontractorName: string
      projectName: string
      recipientEmail: string | null
      daysWaiting: number
    }> = []

    const now = Date.now()

    for (const pending of pendingResponses) {
      // Determine recipient
      const recipientEmail = pending.broker_email || pending.contact_email
      if (!recipientEmail) continue

      // Parse deficiencies for the email
      let deficiencies: Array<{ type: string; description: string }> = []
      try {
        deficiencies = JSON.parse(pending.deficiencies || '[]')
      } catch {
        deficiencies = []
      }

      const deficiencyList = deficiencies.map(d => `- ${d.description}`).join('\n')
      const daysWaiting = Math.floor(pending.days_since_last)

      const emailSubject = `[Follow-up ${daysWaiting > 7 ? 'URGENT' : ''}] Insurance Certificate Required - ${pending.project_name}`.trim()
      const emailBody = `Dear ${pending.subcontractor_name},

This is a follow-up regarding your Certificate of Currency for project "${pending.project_name}".

We sent you a notification ${daysWaiting} day${daysWaiting !== 1 ? 's' : ''} ago regarding deficiencies with your submitted insurance certificate. We have not yet received an updated certificate addressing these issues.

${daysWaiting >= 7 ? 'URGENT: Immediate action is required to maintain compliance on this project.\n\n' : ''}Original Issues:
${deficiencyList || 'Please contact us for specific details.'}

Please submit an updated Certificate of Currency as soon as possible to maintain compliance.

If you have already submitted an updated certificate, please disregard this message.

Thank you for your prompt attention to this matter.

Best regards,
The Compliance Team`

      // Actually send the email via Resend
      let emailStatus: 'sent' | 'pending' | 'failed' = 'sent'
      let emailError: string | undefined

      if (isEmailConfigured()) {
        const emailResult = await sendFollowUpEmail({
          recipientEmail,
          subcontractorName: pending.subcontractor_name,
          projectName: pending.project_name,
          deficiencies,
          daysWaiting,
          uploadLink: process.env.NEXT_PUBLIC_APP_URL || undefined
        })

        if (!emailResult.success) {
          emailStatus = 'failed'
          emailError = emailResult.error
          console.error('[Follow-up] Failed to send email:', emailResult.error)
        }
      } else {
        console.log('[Follow-up] Email not configured, recording communication without sending')
      }

      // Create follow-up communication in Convex
      const communicationId = await convex.mutation(api.communications.create, {
        subcontractorId: pending.subcontractor_id as Id<"subcontractors">,
        projectId: pending.project_id as Id<"projects">,
        verificationId: pending.verification_id as Id<"verifications">,
        type: 'follow_up',
        channel: 'email',
        recipientEmail,
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
        action: 'auto_follow_up',
        details: {
          verification_id: pending.verification_id,
          subcontractor_name: pending.subcontractor_name,
          project_name: pending.project_name,
          days_waiting: daysWaiting,
          trigger: 'manual'
        }
      })

      followupsSent.push({
        communicationId,
        subcontractorName: pending.subcontractor_name,
        projectName: pending.project_name,
        recipientEmail,
        daysWaiting
      })
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${followupsSent.length} follow-up email${followupsSent.length !== 1 ? 's' : ''}`,
      followupsSent,
      pendingResponsesFound: pendingResponses.length
    })

  } catch (error) {
    console.error('Trigger followups error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/communications/trigger-followups - Preview which follow-ups would be sent
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

    const { searchParams } = new URL(request.url)
    const minDaysWaiting = parseInt(searchParams.get('minDays') || '2')

    // Get follow-up preview from Convex
    const preview = await convex.query(api.dashboard.getFollowupPreview, {
      companyId: user.company_id as Id<"companies">,
      minDaysWaiting,
    })

    return NextResponse.json(preview)

  } catch (error) {
    console.error('Get pending followups error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
