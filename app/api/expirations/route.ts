import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// GET /api/expirations - Get expiration calendar data
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)

    // Optional filters
    const startDateStr = searchParams.get('startDate') || new Date().toISOString().split('T')[0]
    const endDateStr = searchParams.get('endDate') || (() => {
      const d = new Date()
      d.setMonth(d.getMonth() + 3) // Default to 3 months ahead
      return d.toISOString().split('T')[0]
    })()
    const projectId = searchParams.get('projectId')

    const startDate = new Date(startDateStr).getTime()
    const endDate = new Date(endDateStr).getTime()

    const result = await convex.query(api.verifications.getExpirations, {
      companyId: user.company_id as Id<"companies">,
      startDate,
      endDate,
      projectId: projectId ? projectId as Id<"projects"> : undefined,
    })

    return NextResponse.json({
      ...result,
      dateRange: {
        start: startDateStr,
        end: endDateStr,
      },
    })
  } catch (error) {
    console.error('Get expirations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/expirations - Send bulk reminder for selected expirations
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const { expirationIds } = await request.json()

    if (!expirationIds || !Array.isArray(expirationIds) || expirationIds.length === 0) {
      return NextResponse.json({ error: 'Expiration IDs required' }, { status: 400 })
    }

    let sentCount = 0
    const results: Array<{ id: string; success: boolean; error?: string }> = []

    for (const verificationId of expirationIds) {
      try {
        // Get verification details
        const verification = await convex.query(api.verifications.getForExpirationReminder, {
          verificationId: verificationId as Id<"verifications">,
        })

        if (!verification) {
          results.push({ id: verificationId, success: false, error: 'Verification not found' })
          continue
        }

        const recipientEmail = verification.contact_email || verification.broker_email
        if (!recipientEmail) {
          results.push({ id: verificationId, success: false, error: 'No recipient email' })
          continue
        }

        const extractedData = verification.extracted_data as Record<string, unknown> | null
        const expiryDate = extractedData?.period_of_insurance_end as string

        // Create communication record
        await convex.mutation(api.communications.create, {
          subcontractorId: verification.subcontractor_id as Id<"subcontractors">,
          projectId: verification.project_id as Id<"projects">,
          type: 'expiration_reminder',
          channel: 'email',
          recipientEmail,
          subject: `Certificate of Currency Expiring - ${verification.project_name}`,
          body: `Your Certificate of Currency for ${verification.project_name} expires on ${expiryDate}. Please upload a renewed certificate to maintain compliance.`,
          status: 'sent',
          sentAt: Date.now(),
        })

        results.push({ id: verificationId, success: true })
        sentCount++
      } catch (err) {
        console.error('Error sending reminder:', err)
        results.push({ id: verificationId, success: false, error: 'Failed to send' })
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      totalRequested: expirationIds.length,
      results,
    })
  } catch (error) {
    console.error('Send reminder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
