import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'

// GET /api/reviews - List pending reviews
export async function GET(request: NextRequest) {
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

    // Get pending reviews using Convex
    const reviews = await convex.query(api.verifications.getPendingReviews, {
      companyId: user.companyId,
    })

    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('Get pending reviews error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
