import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// GET /api/audit-logs - Get audit logs for the company
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

    // Only admin and risk_manager can view audit logs
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to view audit logs' }, { status: 403 })
    }

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)

    // Optional filters
    const entityType = searchParams.get('entity_type') || undefined
    const entityId = searchParams.get('entity_id') || undefined
    const action = searchParams.get('action') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const result = await convex.query(api.auditLogs.listByCompanyWithFilters, {
      companyId: user.company_id as Id<"companies">,
      entityType,
      entityId,
      action,
      limit,
      offset,
    })

    // Convert to legacy format for API compatibility
    const logs = result.logs.map((log: any) => ({
      id: log._id,
      company_id: log.companyId,
      user_id: log.userId || null,
      entity_type: log.entityType,
      entity_id: log.entityId,
      action: log.action,
      details: log.details || null,
      created_at: new Date(log._creationTime).toISOString(),
      user_name: log.user_name || null,
      user_email: log.user_email || null,
    }))

    return NextResponse.json({
      logs,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    })
  } catch (error) {
    console.error('Get audit logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
