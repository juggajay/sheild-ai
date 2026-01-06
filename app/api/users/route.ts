import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

interface DbUser {
  id: string
  email: string
  name: string
  role: string
  phone: string | null
  avatar_url: string | null
  last_login_at: string | null
  created_at: string
  invitation_status: string | null
}

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

    const db = getDb()

    // Get all users in the company (excluding portal users like subcontractor and broker)
    const users = db.prepare(`
      SELECT
        id,
        email,
        name,
        role,
        phone,
        avatar_url,
        last_login_at,
        created_at,
        invitation_status
      FROM users
      WHERE company_id = ?
        AND role NOT IN ('subcontractor', 'broker')
      ORDER BY created_at DESC
    `).all(currentUser.company_id) as DbUser[]

    // Separate active users and pending invitations
    const activeUsers = users.filter(u => u.invitation_status !== 'pending')
    const pendingInvitations = users.filter(u => u.invitation_status === 'pending')

    return NextResponse.json({
      users: activeUsers,
      pendingInvitations,
      total: users.length
    })
  } catch (error) {
    console.error('List users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
