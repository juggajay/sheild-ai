import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'
import { sendEmail } from '@/lib/resend'

// POST /api/reviews/[id]/request-copy - Request a clearer copy
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

    // Only certain roles can request copy
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to request documents' }, { status: 403 })
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
    const { message } = body

    // Request clearer copy
    const result = await convex.mutation(api.verifications.requestClearerCopy, {
      id: id as Id<"verifications">,
      userId: user._id,
      message,
    })

    // Send email to subcontractor
    if (result.subcontractorEmail) {
      try {
        await sendEmail({
          to: result.subcontractorEmail,
          subject: `Clearer Copy Required: Certificate of Currency for ${result.projectName}`,
          html: `
            <p>Dear ${result.subcontractorName},</p>
            <p>We have reviewed your Certificate of Currency submission for <strong>${result.projectName}</strong> and require a clearer copy of the document.</p>
            ${message ? `<p><strong>Additional notes:</strong> ${message}</p>` : ''}
            <p>Please re-upload a clear, legible copy of your Certificate of Currency through the portal.</p>
            <p>If you have any questions, please contact us.</p>
            <p>Thank you for your cooperation.</p>
          `,
        })
      } catch (emailError) {
        console.error('Failed to send clearer copy request email:', emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Request clearer copy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
