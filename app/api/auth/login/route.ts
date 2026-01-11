import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'
import { getConvex, api } from '@/lib/convex'
import { verifyPassword, getJwtSecret } from '@/lib/auth'
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

    const convex = getConvex()

    // Find user by email (includes password hash for auth)
    const user = await convex.query(api.users.getByEmailInternal, {
      email: email.toLowerCase(),
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Get company info
    let company = null
    if (user.companyId) {
      company = await convex.query(api.companies.getById, { id: user.companyId })
    }

    // Create session - generate JWT token
    const sessionId = uuidv4()
    const token = jwt.sign(
      { sessionId, userId: user._id },
      getJwtSecret(),
      { algorithm: 'HS256', expiresIn: '8h' }
    )
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000 // 8 hours

    // Store session in Convex
    await convex.mutation(api.auth.createSession, {
      userId: user._id,
      token,
      expiresAt,
    })

    // Update last login
    await convex.mutation(api.users.updateLastLogin, { id: user._id })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.companyId,
      userId: user._id,
      entityType: 'user',
      entityId: user._id.toString(),
      action: 'login',
      details: { email: user.email },
    })

    // Return success response
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: company ? {
          id: company._id,
          name: company.name
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
