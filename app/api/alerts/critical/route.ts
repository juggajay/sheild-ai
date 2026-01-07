import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'
import { sendCriticalAlert, sendStopWorkRiskSms } from '@/lib/twilio'
import { sendEmail, textToHtml } from '@/lib/sendgrid'

// POST /api/alerts/critical - Send critical SMS alert for stop work risks
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const body = await request.json()
    const { subcontractorId, projectId, alertType = 'stop_work_risk' } = body

    if (!subcontractorId || !projectId) {
      return NextResponse.json(
        { error: 'subcontractorId and projectId are required' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Get subcontractor and project details
    const subcontractor = db.prepare(`
      SELECT s.*, ps.status, ps.on_site_date
      FROM subcontractors s
      JOIN project_subcontractors ps ON s.id = ps.subcontractor_id
      JOIN projects p ON ps.project_id = p.id
      WHERE s.id = ? AND ps.project_id = ? AND p.company_id = ?
    `).get(subcontractorId, projectId, user.company_id) as {
      id: string
      name: string
      abn: string
      contact_name: string | null
      contact_email: string | null
      contact_phone: string | null
      broker_email: string | null
      broker_phone: string | null
      status: string
      on_site_date: string | null
    } | undefined

    if (!subcontractor) {
      return NextResponse.json(
        { error: 'Subcontractor not found or not associated with project' },
        { status: 404 }
      )
    }

    const project = db.prepare(`
      SELECT * FROM projects WHERE id = ? AND company_id = ?
    `).get(projectId, user.company_id) as {
      id: string
      name: string
      project_manager_id: string | null
    } | undefined

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Determine the issue based on status
    let issue = 'Non-compliant insurance coverage'
    if (subcontractor.status === 'pending') {
      issue = 'No valid Certificate of Currency on file'
    }

    // Get alert recipients (project manager and company admins)
    const recipients = db.prepare(`
      SELECT id, name, email, phone, role
      FROM users
      WHERE company_id = ?
        AND (role = 'admin' OR id = ?)
    `).all(user.company_id, project.project_manager_id) as Array<{
      id: string
      name: string
      email: string
      phone: string | null
      role: string
    }>

    const results = {
      smsAlerts: [] as Array<{ to: string; success: boolean; error?: string }>,
      emailAlerts: [] as Array<{ to: string; success: boolean; error?: string }>
    }

    // Send SMS alerts to recipients with phone numbers
    for (const recipient of recipients) {
      if (recipient.phone) {
        const smsResult = await sendStopWorkRiskSms({
          phoneNumber: recipient.phone,
          subcontractorName: subcontractor.name,
          projectName: project.name,
          reason: issue
        })
        results.smsAlerts.push({
          to: recipient.phone,
          success: smsResult.success,
          error: smsResult.error
        })
      }

      // Also send email alert
      const emailBody = `CRITICAL ALERT - Stop Work Risk

Subcontractor: ${subcontractor.name}
ABN: ${subcontractor.abn}
Project: ${project.name}

Issue: ${issue}

This subcontractor is scheduled to be on-site today (${subcontractor.on_site_date || 'date not specified'}) but does not have valid insurance coverage. Immediate action is required.

Please either:
1. Obtain an updated Certificate of Currency
2. Remove the subcontractor from site
3. Create an exception if approved by management

This is an automated alert from RiskShield AI.`

      const emailResult = await sendEmail({
        to: recipient.email,
        subject: `CRITICAL: Stop Work Risk - ${subcontractor.name} / ${project.name}`,
        html: textToHtml(emailBody),
        text: emailBody
      })

      results.emailAlerts.push({
        to: recipient.email,
        success: emailResult.success,
        error: emailResult.error
      })
    }

    // Log the alert in communications table
    const { v4: uuidv4 } = await import('uuid')

    for (const recipient of recipients) {
      db.prepare(`
        INSERT INTO communications (id, subcontractor_id, project_id, type, channel, recipient_email, subject, body, status, sent_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        uuidv4(),
        subcontractorId,
        projectId,
        'critical_alert',
        'email',
        recipient.email,
        `CRITICAL: Stop Work Risk - ${subcontractor.name} / ${project.name}`,
        `Stop work risk alert for ${subcontractor.name} on ${project.name}: ${issue}`,
        'sent'
      )
    }

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      uuidv4(),
      user.company_id,
      user.id,
      'critical_alert',
      subcontractorId,
      'send_critical_alert',
      JSON.stringify({
        subcontractor_name: subcontractor.name,
        project_name: project.name,
        issue,
        recipients: recipients.map(r => r.email)
      })
    )

    return NextResponse.json({
      success: true,
      message: 'Critical alerts sent',
      results
    })

  } catch (error) {
    console.error('Critical alert error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/alerts/critical - Get stop work risks that need alerts
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const db = getDb()
    const today = new Date().toISOString().split('T')[0]

    // Get stop work risks - subcontractors on-site today with non-compliant status
    const stopWorkRisks = db.prepare(`
      SELECT
        ps.id,
        ps.status,
        ps.on_site_date,
        p.id as project_id,
        p.name as project_name,
        s.id as subcontractor_id,
        s.name as subcontractor_name,
        s.abn as subcontractor_abn,
        s.contact_phone,
        s.broker_phone
      FROM project_subcontractors ps
      JOIN projects p ON ps.project_id = p.id
      JOIN subcontractors s ON ps.subcontractor_id = s.id
      WHERE p.company_id = ?
        AND p.status != 'completed'
        AND ps.on_site_date IS NOT NULL
        AND ps.on_site_date <= ?
        AND ps.status IN ('non_compliant', 'pending')
      ORDER BY ps.on_site_date ASC
    `).all(user.company_id, today)

    return NextResponse.json({
      stopWorkRisks,
      count: stopWorkRisks.length
    })

  } catch (error) {
    console.error('Get critical alerts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
