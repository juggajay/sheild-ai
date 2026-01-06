import { NextResponse } from 'next/server'
import { validateMagicLinkToken, useMagicLinkToken, getOrCreatePortalUser, createPortalSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Validate the magic link token
    const validation = validateMagicLinkToken(token)

    if (!validation.valid || !validation.email) {
      return NextResponse.json(
        { error: validation.error || 'Invalid or expired magic link' },
        { status: 400 }
      )
    }

    return NextResponse.json({ valid: true, email: validation.email })
  } catch (error) {
    console.error('Validate broker magic link error:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { token } = await request.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Validate the magic link token
    const validation = validateMagicLinkToken(token)

    if (!validation.valid || !validation.email) {
      return NextResponse.json(
        { error: validation.error || 'Invalid or expired magic link' },
        { status: 400 }
      )
    }

    // Get or create the broker user (role = 'broker')
    const user = getOrCreatePortalUser(validation.email, 'broker')

    // Create a session
    const { token: sessionToken } = createPortalSession(user.id)

    // Mark the magic link token as used
    useMagicLinkToken(token)

    console.log('\n========================================')
    console.log('BROKER LOGIN SUCCESSFUL')
    console.log('========================================')
    console.log(`Email: ${validation.email}`)
    console.log(`User ID: ${user.id}`)
    console.log('========================================\n')

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })

    // Set auth cookie
    response.cookies.set('auth_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Broker magic link verify error:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
