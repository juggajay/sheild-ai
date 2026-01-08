import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, isProduction, getSupabase } from '@/lib/db'
import { deleteSession, deleteSessionAsync, getUserByToken, getUserByTokenAsync } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (token) {
      if (isProduction) {
        // Production: Use Supabase
        const user = await getUserByTokenAsync(token)
        await deleteSessionAsync(token)

        if (user) {
          const supabase = getSupabase()
          await supabase.from('audit_logs').insert({
            id: uuidv4(),
            company_id: user.company_id,
            user_id: user.id,
            entity_type: 'user',
            entity_id: user.id,
            action: 'logout',
            details: { email: user.email }
          })
        }
      } else {
        // Development: Use SQLite
        const user = getUserByToken(token)
        deleteSession(token)

        if (user) {
          const db = getDb()
          db.prepare(`
            INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
            VALUES (?, ?, ?, 'user', ?, 'logout', ?)
          `).run(uuidv4(), user.company_id, user.id, user.id, JSON.stringify({ email: user.email }))
        }
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
