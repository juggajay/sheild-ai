import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'

// GET /api/reviews/[id] - Get review detail
export async function GET(
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

    // Get verification details
    const reviewData = await convex.query(api.verifications.getVerificationForReview, {
      id: id as Id<"verifications">,
    })

    if (!reviewData) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Verify the review belongs to user's company
    const project = await convex.query(api.projects.getById, {
      id: reviewData.project.id as Id<"projects">,
    })

    if (!project || project.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json(reviewData)
  } catch (error) {
    console.error('Get review detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
