import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { sendStopWorkRiskSms } from '@/lib/twilio'
import { sendEmail, textToHtml } from '@/lib/resend'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// POST /api/alerts/critical - Send critical SMS alert for stop work risks
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
    const { subcontractorId, projectId, alertType = 'stop_work_risk' } = body

    if (!subcontractorId || !projectId) {
      return NextResponse.json(
        { error: 'subcontractorId and projectId are required' },
        { status: 400 }
      )
    }

    // Get subcontractor and project details from Convex
    const subcontractor = await convex.query(api.dashboard.getSubcontractorForAlert, {
      subcontractorId: subcontractorId as Id<"subcontractors">,
      projectId: projectId as Id<"projects">,
      companyId: user.company_id as Id<"companies">,
    })

    if (!subcontractor) {
      return NextResponse.json(
        { error: 'Subcontractor not found or not associated with project' },
        { status: 404 }
      )
    }

    // Get project details
    const project = await convex.query(api.projects.getByIdForCompany, {
      id: projectId as Id<"projects">,
      companyId: user.company_id as Id<"companies">,
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Determine the issue based on status
    let issue = 'Non-compliant insurance coverage'
    if (subcontractor.status === 'pending') {
      issue = 'No valid Certificate of Currency on file'
    }

    // Get alert recipients (project manager and company admins)
    const recipients = await convex.query(api.dashboard.getAlertRecipients, {
      companyId: user.company_id as Id<"companies">,
      projectManagerId: project.project_manager_id as Id<"users"> | undefined,
    })

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
    for (const recipient of recipients) {
      await convex.mutation(api.communications.create, {
        subcontractorId: subcontractorId as Id<"subcontractors">,
        projectId: projectId as Id<"projects">,
        type: 'critical_alert',
        channel: 'email',
        recipientEmail: recipient.email,
        subject: `CRITICAL: Stop Work Risk - ${subcontractor.name} / ${project.name}`,
        body: `Stop work risk alert for ${subcontractor.name} on ${project.name}: ${issue}`,
        status: 'sent',
        sentAt: Date.now(),
      })
    }

    // Log audit entry
    await convex.mutation(api.auditLogs.create, {
      companyId: user.company_id as Id<"companies">,
      userId: user.id as Id<"users">,
      entityType: 'critical_alert',
      entityId: subcontractorId,
      action: 'send_critical_alert',
      details: {
        subcontractor_name: subcontractor.name,
        project_name: project.name,
        issue,
        recipients: recipients.map(r => r.email)
      }
    })

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

    // Get stop work risks from Convex
    const stopWorkRisks = await convex.query(api.dashboard.getStopWorkRisks, {
      companyId: user.company_id as Id<"companies">,
    })

    return NextResponse.json({
      stopWorkRisks,
      count: stopWorkRisks.length
    })

  } catch (error) {
    console.error('Get critical alerts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
