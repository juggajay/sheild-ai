import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (token) {
      const convex = getConvex()

      // Get user from session before deleting
      const sessionData = await convex.query(api.auth.getUserWithSession, { token })

      // Delete the session
      await convex.mutation(api.auth.deleteSession, { token })

      // Log the action if user was found
      if (sessionData?.user) {
        await convex.mutation(api.auditLogs.create, {
          companyId: sessionData.user.companyId,
          userId: sessionData.user._id,
          entityType: 'user',
          entityId: sessionData.user._id.toString(),
          action: 'logout',
          details: { email: sessionData.user.email },
        })
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
