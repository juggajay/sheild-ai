import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, isProduction, getSupabase, type User } from '@/lib/db'
import { verifyPassword, createSession, createSessionAsync } from '@/lib/auth'
import { authLimiter, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResult = authLimiter.check(request, 'login')
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult)
  }

  try {
    const body = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    let user: (User & { company_name?: string }) | null = null
    let token: string

    if (isProduction) {
      // Production: Use Supabase
      const supabase = getSupabase()

      // Find user by email with company join
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          companies:company_id (name)
        `)
        .eq('email', email.toLowerCase())
        .single()

      if (userError || !userData) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      user = {
        ...userData,
        company_name: userData.companies?.name
      } as User & { company_name?: string }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password_hash)
      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      // Update last login
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id)

      // Create session
      const sessionResult = await createSessionAsync(user.id)
      token = sessionResult.token

      // Log the action
      await supabase.from('audit_logs').insert({
        id: uuidv4(),
        company_id: user.company_id,
        user_id: user.id,
        entity_type: 'user',
        entity_id: user.id,
        action: 'login',
        details: { email: user.email }
      })

    } else {
      // Development: Use SQLite
      const db = getDb()

      // Find user by email
      const userData = db.prepare(`
        SELECT u.*, c.name as company_name
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.email = ?
      `).get(email.toLowerCase()) as (User & { company_name?: string }) | undefined

      if (!userData) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      user = userData

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password_hash)
      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      // Update last login
      db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id)

      // Create session
      const sessionResult = createSession(user.id)
      token = sessionResult.token

      // Log the action
      db.prepare(`
        INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
        VALUES (?, ?, ?, 'user', ?, 'login', ?)
      `).run(uuidv4(), user.company_id, user.id, user.id, JSON.stringify({ email: user.email }))
    }

    // Return success response
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: user.company_id ? {
          id: user.company_id,
          name: user.company_name
        } : null
      }
    })

    // Set auth cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
