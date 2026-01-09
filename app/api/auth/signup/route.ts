import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { useSupabase, getSupabase } from '@/lib/db/supabase-db'
import { hashPassword, validatePassword, createSession } from '@/lib/auth'
import { isValidABN } from '@/lib/utils'
import { authLimiter, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResult = authLimiter.check(request, 'signup')
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult)
  }

  try {
    const body = await request.json()
    const { email, password, name, companyName, abn } = body

    // Validate required fields
    if (!email || !password || !name || !companyName || !abn) {
      return NextResponse.json(
        { error: 'All fields are required: email, password, name, companyName, abn' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join('. ') },
        { status: 400 }
      )
    }

    // Validate ABN format
    const cleanedABN = abn.replace(/\s/g, '')
    if (!isValidABN(cleanedABN)) {
      return NextResponse.json(
        { error: 'Invalid ABN format. ABN must be 11 digits.' },
        { status: 400 }
      )
    }

    // Determine which database to use
    const isSupabase = useSupabase()

    // Debug logging for production issues
    console.log('Signup - useSupabase:', isSupabase)
    console.log('Signup - SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('Signup - SERVICE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Variables for user/company IDs
    const companyId = uuidv4()
    const userId = uuidv4()
    const forwardingEmail = `coc-${companyId.split('-')[0]}@riskshield.ai`
    const passwordHash = await hashPassword(password)

    let sessionToken: string

    if (isSupabase) {
      // Use Supabase for production
      const supabase = getSupabase()

      // Check if email already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single()

      if (existingUser) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        )
      }

      // Check if ABN already exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('abn', cleanedABN)
        .single()

      if (existingCompany) {
        return NextResponse.json(
          { error: 'A company with this ABN already exists' },
          { status: 409 }
        )
      }

      // Create company
      const { error: companyError } = await supabase
        .from('companies')
        .insert({
          id: companyId,
          name: companyName.trim(),
          abn: cleanedABN,
          forwarding_email: forwardingEmail,
          primary_contact_name: name.trim(),
          primary_contact_email: email.toLowerCase(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (companyError) throw companyError

      // Create user with admin role
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          company_id: companyId,
          email: email.toLowerCase(),
          password_hash: passwordHash,
          name: name.trim(),
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (userError) throw userError

      // Create session
      const { token } = createSession(userId)
      sessionToken = token

      // Store session in Supabase
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hours
      await supabase
        .from('sessions')
        .insert({
          id: uuidv4(),
          user_id: userId,
          token: sessionToken,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        })

      // Log the actions
      await supabase
        .from('audit_logs')
        .insert([
          {
            id: uuidv4(),
            company_id: companyId,
            user_id: userId,
            entity_type: 'company',
            entity_id: companyId,
            action: 'create',
            details: JSON.stringify({ companyName, abn: cleanedABN }),
            created_at: new Date().toISOString()
          },
          {
            id: uuidv4(),
            company_id: companyId,
            user_id: userId,
            entity_type: 'user',
            entity_id: userId,
            action: 'signup',
            details: JSON.stringify({ email: email.toLowerCase(), role: 'admin' }),
            created_at: new Date().toISOString()
          }
        ])
    } else {
      // Use SQLite for development - dynamic import to avoid loading native module in production
      const { getDb } = await import('@/lib/db')
      const db = getDb()

      // Check if email already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
      if (existingUser) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        )
      }

      // Check if ABN already exists
      const existingCompany = db.prepare('SELECT id FROM companies WHERE abn = ?').get(cleanedABN)
      if (existingCompany) {
        return NextResponse.json(
          { error: 'A company with this ABN already exists' },
          { status: 409 }
        )
      }

      // Create company
      db.prepare(`
        INSERT INTO companies (id, name, abn, forwarding_email, primary_contact_name, primary_contact_email)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(companyId, companyName.trim(), cleanedABN, forwardingEmail, name.trim(), email.toLowerCase())

      // Create user with admin role
      db.prepare(`
        INSERT INTO users (id, company_id, email, password_hash, name, role)
        VALUES (?, ?, ?, ?, ?, 'admin')
      `).run(userId, companyId, email.toLowerCase(), passwordHash, name.trim())

      // Create session
      const { token } = createSession(userId)
      sessionToken = token

      // Log the action
      db.prepare(`
        INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
        VALUES (?, ?, ?, 'company', ?, 'create', ?)
      `).run(uuidv4(), companyId, userId, companyId, JSON.stringify({ companyName, abn: cleanedABN }))

      db.prepare(`
        INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
        VALUES (?, ?, ?, 'user', ?, 'signup', ?)
      `).run(uuidv4(), companyId, userId, userId, JSON.stringify({ email: email.toLowerCase(), role: 'admin' }))
    }

    // Return success response with token
    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: userId,
        email: email.toLowerCase(),
        name: name.trim(),
        role: 'admin',
        company: {
          id: companyId,
          name: companyName.trim(),
          abn: cleanedABN
        }
      }
    }, { status: 201 })

    // Set auth cookie
    response.cookies.set('auth_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)
    // Include error details for debugging (safe because we control error messages)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}
