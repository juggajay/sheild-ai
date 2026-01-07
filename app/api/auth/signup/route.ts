import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
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
    const companyId = uuidv4()
    const forwardingEmail = `coc-${companyId.split('-')[0]}@riskshield.ai`

    db.prepare(`
      INSERT INTO companies (id, name, abn, forwarding_email, primary_contact_name, primary_contact_email)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(companyId, companyName.trim(), cleanedABN, forwardingEmail, name.trim(), email.toLowerCase())

    // Create user with admin role
    const userId = uuidv4()
    const passwordHash = await hashPassword(password)

    db.prepare(`
      INSERT INTO users (id, company_id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?, 'admin')
    `).run(userId, companyId, email.toLowerCase(), passwordHash, name.trim())

    // Create session
    const { token } = createSession(userId)

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'company', ?, 'create', ?)
    `).run(uuidv4(), companyId, userId, companyId, JSON.stringify({ companyName, abn: cleanedABN }))

    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'user', ?, 'signup', ?)
    `).run(uuidv4(), companyId, userId, userId, JSON.stringify({ email: email.toLowerCase(), role: 'admin' }))

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
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
