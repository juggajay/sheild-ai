import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { getUserByToken } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// GET /api/portal/builders - Get all builder relationships for portal user
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

    // Use Convex query to get all builder relationships for this portal user
    const result = await convex.query(api.portal.getBuilders, {
      userEmail: user.email,
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Get portal builders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
