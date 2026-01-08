import { NextResponse } from 'next/server'
import { useSupabase } from '@/lib/db/supabase-db'
import { validatePasswordResetToken, validatePasswordResetTokenAsync } from '@/lib/auth'

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

    const validation = useSupabase()
      ? await validatePasswordResetTokenAsync(token)
      : validatePasswordResetToken(token)

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid or expired reset link' },
        { status: 400 }
      )
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('Validate reset token error:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
