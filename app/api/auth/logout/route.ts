import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { deleteSession, getUserByToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (token) {
      // Get user info before deleting session for audit logging
      const user = getUserByToken(token)

      // Delete the session
      deleteSession(token)

      // Log the logout action
      if (user) {
        const db = getDb()
        db.prepare(`
          INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
          VALUES (?, ?, ?, 'user', ?, 'logout', ?)
        `).run(uuidv4(), user.company_id, user.id, user.id, JSON.stringify({ email: user.email }))
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

    // Clear auth cookie
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
