import { NextRequest, NextResponse } from 'next/server'
import { useSupabase } from '@/lib/db/supabase-db'
import {
  validatePasswordResetToken,
  validatePasswordResetTokenAsync,
  usePasswordResetToken,
  usePasswordResetTokenAsync,
  updateUserPassword,
  updateUserPasswordAsync,
  validatePassword
} from '@/lib/auth'
import { authLimiter, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Security: Rate limiting to prevent brute force attacks
  const rateLimitResult = authLimiter.check(request, 'reset-password')
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult)
  }

  try {
    const { token, password } = await request.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Validate password requirements
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 }
      )
    }

    // Validate the reset token (use async for Supabase)
    const tokenValidation = useSupabase()
      ? await validatePasswordResetTokenAsync(token)
      : validatePasswordResetToken(token)
    if (!tokenValidation.valid || !tokenValidation.userId) {
      return NextResponse.json(
        { error: tokenValidation.error || 'Invalid or expired reset link' },
        { status: 400 }
      )
    }

    // Security: Mark the token as used BEFORE updating password to prevent race condition
    if (useSupabase()) {
      await usePasswordResetTokenAsync(token)
    } else {
      usePasswordResetToken(token)
    }

    // Update the password
    if (useSupabase()) {
      await updateUserPasswordAsync(tokenValidation.userId, password)
    } else {
      await updateUserPassword(tokenValidation.userId, password)
    }

    // Security: Only log sensitive operations in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n========================================')
      console.log('PASSWORD RESET SUCCESSFUL')
      console.log('========================================')
      console.log(`User ID: ${tokenValidation.userId}`)
      console.log('Password has been updated and all sessions invalidated.')
      console.log('========================================\n')
    }

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully'
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
