import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'

// POST /api/reviews/[id]/approve - Approve a verification
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

    // Only certain roles can approve
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to approve verifications' }, { status: 403 })
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

    // Approve the verification
    const result = await convex.mutation(api.verifications.approveVerification, {
      id: id as Id<"verifications">,
      userId: user._id,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Approve verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
