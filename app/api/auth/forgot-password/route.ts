import { NextRequest, NextResponse } from 'next/server'
import { useSupabase } from '@/lib/db/supabase-db'
import { createPasswordResetToken, createPasswordResetTokenAsync, getUserByEmail, getUserByEmailAsync } from '@/lib/auth'
import { sendPasswordResetEmail, isSendGridConfigured } from '@/lib/sendgrid'
import { authLimiter, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResult = authLimiter.check(request, 'forgot-password')
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult)
  }

  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists (use async for Supabase in production)
    const user = useSupabase()
      ? await getUserByEmailAsync(normalizedEmail)
      : getUserByEmail(normalizedEmail)

    // Always return success to prevent email enumeration
    // But only create token and log if user exists
    if (user) {
      const { token, expiresAt } = useSupabase()
        ? await createPasswordResetTokenAsync(user.id)
        : createPasswordResetToken(user.id)

      // Build reset URL
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'}/reset-password?token=${token}`

      // In development or if SendGrid not configured, log the reset link to the console
      if (process.env.NODE_ENV === 'development' || !isSendGridConfigured()) {
        // Security: Only log sensitive info in development
        if (process.env.NODE_ENV !== 'production') {
          console.log('\n========================================')
          console.log('PASSWORD RESET LINK (Development Mode)')
          console.log('========================================')
          console.log(`Email: ${normalizedEmail}`)
          console.log(`Reset URL: ${resetUrl}`)
          console.log(`Expires: ${expiresAt}`)
          console.log('========================================\n')
        }
      }

      // Send email via SendGrid if configured
      if (isSendGridConfigured()) {
        const result = await sendPasswordResetEmail({
          recipientEmail: normalizedEmail,
          recipientName: user.name,
          resetLink: resetUrl,
          expiresInMinutes: 60
        })

        if (!result.success) {
          console.error('[Password Reset] Failed to send email:', result.error)
          // Don't expose failure to prevent enumeration
        } else {
          console.log('[Password Reset] Email sent successfully to:', normalizedEmail)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.'
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
