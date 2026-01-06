import { NextResponse } from 'next/server'
import { createMagicLinkToken } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Create magic link token
    const { token, expiresAt } = createMagicLinkToken(normalizedEmail)

    // In development, log the magic link to the console
    const magicLinkUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/broker/verify?token=${token}`

    console.log('\n========================================')
    console.log('BROKER MAGIC LINK (Development Mode)')
    console.log('========================================')
    console.log(`Email: ${normalizedEmail}`)
    console.log(`Magic Link URL: ${magicLinkUrl}`)
    console.log(`Expires: ${expiresAt}`)
    console.log('========================================\n')

    // In production, this would send an email via SendGrid
    // await sendMagicLinkEmail(normalizedEmail, magicLinkUrl)

    return NextResponse.json({
      success: true,
      message: 'Magic link sent! Check your email to sign in.'
    })
  } catch (error) {
    console.error('Broker magic link error:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
