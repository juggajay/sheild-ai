import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'
import { sendFollowUpEmail, isSendGridConfigured } from '@/lib/sendgrid'

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

    const body = await request.json().catch(() => ({}))
    const { minDaysWaiting = 2, maxFollowups = 10 } = body

    const db = getDb()
    const now = new Date().toISOString()

    // Find failed verifications where:
    // 1. A deficiency email was sent
    // 2. No new COC has been uploaded since
    // 3. At least minDaysWaiting days have passed
    // 4. We haven't sent a follow-up in the last 24 hours
    const pendingResponses = db.prepare(`
      SELECT DISTINCT
        v.id as verification_id,
        v.deficiencies,
        d.id as document_id,
        d.file_name,
        s.id as subcontractor_id,
        s.name as subcontractor_name,
        s.contact_email,
        s.broker_email,
        p.id as project_id,
        p.name as project_name,
        c.id as last_communication_id,
        c.sent_at as last_sent_at,
        c.type as last_type,
        CAST(julianday('now') - julianday(c.sent_at) AS REAL) as days_since_last
      FROM verifications v
      JOIN coc_documents d ON v.coc_document_id = d.id
      JOIN subcontractors s ON d.subcontractor_id = s.id
      JOIN projects p ON d.project_id = p.id
      JOIN communications c ON c.verification_id = v.id
      WHERE p.company_id = ?
        AND p.status != 'completed'
        AND v.status = 'fail'
        AND c.status IN ('sent', 'delivered', 'opened')
        AND c.type IN ('deficiency', 'follow_up')
        -- No newer COC uploaded after the last communication
        AND NOT EXISTS (
          SELECT 1 FROM coc_documents d2
          WHERE d2.subcontractor_id = s.id
            AND d2.project_id = p.id
            AND d2.received_at > c.sent_at
        )
        -- No follow-up sent in the last 24 hours
        AND NOT EXISTS (
          SELECT 1 FROM communications c2
          WHERE c2.verification_id = v.id
            AND c2.type = 'follow_up'
            AND c2.sent_at > datetime('now', '-1 day')
        )
        -- At least minDaysWaiting since last communication
        AND julianday('now') - julianday(c.sent_at) >= ?
      ORDER BY days_since_last DESC
      LIMIT ?
    `).all(user.company_id, minDaysWaiting, maxFollowups) as Array<{
      verification_id: string
      deficiencies: string
      document_id: string
      file_name: string
      subcontractor_id: string
      subcontractor_name: string
      contact_email: string | null
      broker_email: string | null
      project_id: string
      project_name: string
      last_communication_id: string
      last_sent_at: string
      last_type: string
      days_since_last: number
    }>

    const followupsSent: Array<{
      communicationId: string
      subcontractorName: string
      projectName: string
      recipientEmail: string | null
      daysWaiting: number
    }> = []

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

      // Create follow-up communication
      const communicationId = uuidv4()

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

      // Actually send the email via SendGrid
      let emailStatus = 'sent'
      let emailError: string | undefined

      if (isSendGridConfigured()) {
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
        console.log('[Follow-up] SendGrid not configured, recording communication without sending')
      }

      db.prepare(`
        INSERT INTO communications (
          id, subcontractor_id, project_id, verification_id,
          type, channel, recipient_email, subject, body,
          status, sent_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        communicationId,
        pending.subcontractor_id,
        pending.project_id,
        pending.verification_id,
        'follow_up',
        'email',
        recipientEmail,
        emailSubject,
        emailBody,
        emailStatus,
        emailStatus === 'sent' ? now : null,
        now,
        now
      )

      // Log the audit entry
      db.prepare(`
        INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        user.company_id,
        user.id,
        'communication',
        communicationId,
        'auto_follow_up',
        JSON.stringify({
          verification_id: pending.verification_id,
          subcontractor_name: pending.subcontractor_name,
          project_name: pending.project_name,
          days_waiting: daysWaiting,
          trigger: 'manual'
        }),
        now
      )

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

    const { searchParams } = new URL(request.url)
    const minDaysWaiting = parseInt(searchParams.get('minDays') || '2')

    const db = getDb()

    // Find pending responses that would get follow-ups
    const pendingResponses = db.prepare(`
      SELECT DISTINCT
        v.id as verification_id,
        v.status as verification_status,
        s.id as subcontractor_id,
        s.name as subcontractor_name,
        s.contact_email,
        s.broker_email,
        p.id as project_id,
        p.name as project_name,
        c.id as last_communication_id,
        c.sent_at as last_sent_at,
        c.type as last_type,
        CAST(julianday('now') - julianday(c.sent_at) AS REAL) as days_since_last,
        (SELECT COUNT(*) FROM communications c3
         WHERE c3.verification_id = v.id AND c3.type = 'follow_up') as follow_up_count
      FROM verifications v
      JOIN coc_documents d ON v.coc_document_id = d.id
      JOIN subcontractors s ON d.subcontractor_id = s.id
      JOIN projects p ON d.project_id = p.id
      JOIN communications c ON c.verification_id = v.id
      WHERE p.company_id = ?
        AND p.status != 'completed'
        AND v.status = 'fail'
        AND c.status IN ('sent', 'delivered', 'opened')
        AND c.type IN ('deficiency', 'follow_up')
        -- No newer COC uploaded
        AND NOT EXISTS (
          SELECT 1 FROM coc_documents d2
          WHERE d2.subcontractor_id = s.id
            AND d2.project_id = p.id
            AND d2.received_at > c.sent_at
        )
      ORDER BY days_since_last DESC
    `).all(user.company_id) as Array<{
      verification_id: string
      verification_status: string
      subcontractor_id: string
      subcontractor_name: string
      contact_email: string | null
      broker_email: string | null
      project_id: string
      project_name: string
      last_communication_id: string
      last_sent_at: string
      last_type: string
      days_since_last: number
      follow_up_count: number
    }>

    // Determine which would get follow-ups
    const wouldGetFollowup = pendingResponses.filter(p => p.days_since_last >= minDaysWaiting)
    const notYetDue = pendingResponses.filter(p => p.days_since_last < minDaysWaiting)

    return NextResponse.json({
      wouldGetFollowup: wouldGetFollowup.map(p => ({
        subcontractorName: p.subcontractor_name,
        projectName: p.project_name,
        daysWaiting: Math.floor(p.days_since_last),
        followUpCount: p.follow_up_count,
        recipientEmail: p.broker_email || p.contact_email
      })),
      notYetDue: notYetDue.map(p => ({
        subcontractorName: p.subcontractor_name,
        projectName: p.project_name,
        daysWaiting: Math.floor(p.days_since_last),
        daysUntilFollowup: Math.ceil(minDaysWaiting - p.days_since_last)
      })),
      summary: {
        wouldSend: wouldGetFollowup.length,
        notYetDue: notYetDue.length,
        total: pendingResponses.length
      }
    })

  } catch (error) {
    console.error('Get pending followups error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
