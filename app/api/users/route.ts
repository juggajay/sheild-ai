import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// GET /api/users - List all users in the company
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const currentUser = getUserByToken(token)
    if (!currentUser) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admins can list users
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can view user list' }, { status: 403 })
    }

    if (!currentUser.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const result = await convex.query(api.users.listByCompanyFiltered, {
      companyId: currentUser.company_id as Id<"companies">,
    })

    return NextResponse.json({
      users: result.users,
      pendingInvitations: result.pendingInvitations,
      total: result.total,
    })
  } catch (error) {
    console.error('List users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
