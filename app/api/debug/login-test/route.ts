import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

// POST /api/debug/login-test - Create and login as test user for development
export async function POST(request: NextRequest) {
  try {
    const db = getDb()

    // Check if test admin exists
    let user = db.prepare(`
      SELECT * FROM users WHERE email = 'testadmin@riskshield.com'
    `).get() as { id: string; email: string; name: string; role: string; password_hash: string } | undefined

    if (!user) {
      // Create test admin user
      const userId = uuidv4()
      const passwordHash = await bcrypt.hash('testadmin123', 10)

      // Get or create a company
      let company = db.prepare(`SELECT id FROM companies LIMIT 1`).get() as { id: string } | undefined

      if (!company) {
        const companyId = uuidv4()
        db.prepare(`
          INSERT INTO companies (id, name, abn) VALUES (?, 'Test Company', '12345678901')
        `).run(companyId)
        company = { id: companyId }
      }

      db.prepare(`
        INSERT INTO users (id, email, name, password_hash, role, company_id, invitation_status)
        VALUES (?, 'testadmin@riskshield.com', 'Test Admin', ?, 'admin', ?, 'accepted')
      `).run(userId, passwordHash, company.id)

      user = db.prepare(`
        SELECT * FROM users WHERE id = ?
      `).get(userId) as { id: string; email: string; name: string; role: string; password_hash: string }
    }

    // Create session
    const session = createSession(user.id)

    // Set cookie
    const response = NextResponse.json({
      message: 'Logged in as test admin',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })

    response.cookies.set('auth_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Debug login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
