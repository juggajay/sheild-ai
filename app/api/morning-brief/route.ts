import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// GET /api/morning-brief - Get dashboard morning brief data
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

    // Get all morning brief data in a single efficient query
    const briefData = await convex.query(api.dashboard.getMorningBrief, {
      companyId: user.company_id as Id<"companies">,
    })

    return NextResponse.json(briefData)

  } catch (error) {
    console.error('Morning brief error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
