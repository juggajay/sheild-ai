import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// GET /api/compliance-history - Get compliance trend data
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
      return NextResponse.json({ error: 'User not associated with a company' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)

    // Get date range - default to last 30 days
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)
    const startDateTimestamp = startDate.getTime()

    // Ensure today's snapshot exists
    await convex.mutation(api.complianceSnapshots.createTodaySnapshot, {
      companyId: user.company_id as Id<"companies">,
    })

    // Get historical snapshots
    const snapshots = await convex.query(api.complianceSnapshots.getHistory, {
      companyId: user.company_id as Id<"companies">,
      startDate: startDateTimestamp,
    })

    // If we don't have enough historical data, generate some
    if (snapshots.length < 7) {
      await convex.mutation(api.complianceSnapshots.generateHistoricalSnapshots, {
        companyId: user.company_id as Id<"companies">,
        days,
      })

      // Fetch again after generation
      const generatedSnapshots = await convex.query(api.complianceSnapshots.getHistory, {
        companyId: user.company_id as Id<"companies">,
        startDate: startDateTimestamp,
      })

      return NextResponse.json({
        history: generatedSnapshots,
        days,
        generated: true,
      })
    }

    return NextResponse.json({
      history: snapshots,
      days,
      generated: false,
    })
  } catch (error) {
    console.error('Compliance history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
