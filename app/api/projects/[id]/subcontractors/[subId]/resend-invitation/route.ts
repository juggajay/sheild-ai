import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'
import { resendInvitation } from '@/lib/invitation'

// POST /api/projects/[id]/subcontractors/[subId]/resend-invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  try {
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

    // Only admin, risk_manager, project_manager can resend invitations
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to resend invitations' }, { status: 403 })
    }

    const { id, subId } = await params

    // Validate access to project
    const accessResult = await convex.query(api.projects.validateAccess, {
      projectId: id as Id<"projects">,
      userId: user._id,
      userRole: user.role,
      userCompanyId: user.companyId,
    })

    if (!accessResult.canAccess) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    // Find the project-subcontractor assignment
    const assignment = await convex.query(api.projectSubcontractors.getByProjectAndSubcontractor, {
      projectId: id as Id<"projects">,
      subcontractorId: subId as Id<"subcontractors">,
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Subcontractor is not assigned to this project' }, { status: 404 })
    }

    // Get subcontractor email
    const subcontractor = await convex.query(api.subcontractors.getById, {
      id: subId as Id<"subcontractors">,
    })

    if (!subcontractor?.contactEmail) {
      return NextResponse.json({ error: 'Subcontractor has no contact email' }, { status: 400 })
    }

    // Resend the invitation
    const result = await resendInvitation(assignment._id)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to resend invitation' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation resent successfully',
      email: subcontractor.contactEmail
    })

  } catch (error) {
    console.error('Resend invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
