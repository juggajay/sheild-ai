import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'
import { sendDeficiencyEmail } from '@/lib/resend'

// POST /api/reviews/[id]/reject - Reject a verification
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    // Only certain roles can reject
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to reject verifications' }, { status: 403 })
    }

    // Get verification to check access
    const verification = await convex.query(api.verifications.getById, {
      id: id as Id<"verifications">,
    })

    if (!verification) {
      return NextResponse.json({ error: 'Verification not found' }, { status: 404 })
    }

    // Verify the verification belongs to user's company
    const project = await convex.query(api.projects.getById, {
      id: verification.projectId,
    })

    if (!project || project.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { reason, deficiencies } = body

    // Reject the verification
    const result = await convex.mutation(api.verifications.rejectVerification, {
      id: id as Id<"verifications">,
      userId: user._id,
      reason,
      deficiencies,
    })

    // Send deficiency email if we have recipient info
    if (result.shouldSendEmail && result.subcontractorEmail) {
      try {
        await sendDeficiencyEmail({
          recipientEmail: result.subcontractorEmail,
          recipientName: result.subcontractorName || 'Subcontractor',
          subcontractorName: result.subcontractorName || 'Your company',
          projectName: result.projectName || 'the project',
          subcontractorAbn: '',
          deficiencies: deficiencies || [],
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          uploadLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.riskshield.ai'}/portal`,
        })
      } catch (emailError) {
        console.error('Failed to send deficiency email:', emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Reject verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
