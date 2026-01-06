import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

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

    const db = getDb()
    const { searchParams } = new URL(request.url)

    // Optional filters
    const entityType = searchParams.get('entity_type')
    const entityId = searchParams.get('entity_id')
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query with optional filters
    let query = `
      SELECT al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.company_id = ?
    `
    const params: (string | number)[] = [user.company_id]

    if (entityType) {
      query += ' AND al.entity_type = ?'
      params.push(entityType)
    }

    if (entityId) {
      query += ' AND al.entity_id = ?'
      params.push(entityId)
    }

    if (action) {
      query += ' AND al.action = ?'
      params.push(action)
    }

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const logs = db.prepare(query).all(...params) as Array<{
      id: string
      company_id: string
      user_id: string | null
      entity_type: string
      entity_id: string
      action: string
      details: string
      created_at: string
      user_name: string | null
      user_email: string | null
    }>

    // Parse details JSON for each log
    const parsedLogs = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    }))

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      WHERE al.company_id = ?
    `
    const countParams: string[] = [user.company_id]

    if (entityType) {
      countQuery += ' AND al.entity_type = ?'
      countParams.push(entityType)
    }

    if (entityId) {
      countQuery += ' AND al.entity_id = ?'
      countParams.push(entityId)
    }

    if (action) {
      countQuery += ' AND al.action = ?'
      countParams.push(action)
    }

    const countResult = db.prepare(countQuery).get(...countParams) as { total: number }

    return NextResponse.json({
      logs: parsedLogs,
      total: countResult.total,
      limit,
      offset
    })

  } catch (error) {
    console.error('Get audit logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
