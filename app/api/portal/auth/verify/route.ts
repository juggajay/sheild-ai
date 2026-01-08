import { NextResponse } from 'next/server'
import { validateMagicLinkToken, useMagicLinkToken, getOrCreatePortalUser, createPortalSession } from '@/lib/auth'
import { verifyInvitationToken, markInvitationUsed } from '@/lib/invitation'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const type = searchParams.get('type')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Check if this is an invitation token
    if (type === 'invitation') {
      const invitationValidation = verifyInvitationToken(token)

      if (!invitationValidation.valid || !invitationValidation.email) {
        return NextResponse.json(
          { error: invitationValidation.error || 'Invalid or expired invitation' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        valid: true,
        email: invitationValidation.email,
        type: 'invitation',
        projectId: invitationValidation.projectId,
        subcontractorId: invitationValidation.subcontractorId
      })
    }

    // Validate the magic link token
    const validation = validateMagicLinkToken(token)

    if (!validation.valid || !validation.email) {
      return NextResponse.json(
        { error: validation.error || 'Invalid or expired magic link' },
        { status: 400 }
      )
    }

    return NextResponse.json({ valid: true, email: validation.email, type: 'magic_link' })
  } catch (error) {
    console.error('Validate magic link error:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { token, type } = await request.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    let email: string
    let projectId: string | undefined
    let subcontractorId: string | undefined
    let isInvitation = type === 'invitation'

    // Check if this is an invitation token
    if (isInvitation) {
      const invitationValidation = verifyInvitationToken(token)

      if (!invitationValidation.valid || !invitationValidation.email) {
        return NextResponse.json(
          { error: invitationValidation.error || 'Invalid or expired invitation' },
          { status: 400 }
        )
      }

      email = invitationValidation.email
      projectId = invitationValidation.projectId
      subcontractorId = invitationValidation.subcontractorId

      // Mark invitation as used
      markInvitationUsed(token)
    } else {
      // Validate the magic link token
      const validation = validateMagicLinkToken(token)

      if (!validation.valid || !validation.email) {
        return NextResponse.json(
          { error: validation.error || 'Invalid or expired magic link' },
          { status: 400 }
        )
      }

      email = validation.email

      // Mark the magic link token as used
      useMagicLinkToken(token)
    }

    // Get or create the portal user
    const user = getOrCreatePortalUser(email, 'subcontractor')

    // Create a session
    const { token: sessionToken } = createPortalSession(user.id)

    console.log('\n========================================')
    console.log(isInvitation ? 'PORTAL INVITATION LOGIN SUCCESSFUL' : 'PORTAL LOGIN SUCCESSFUL')
    console.log('========================================')
    console.log(`Email: ${email}`)
    console.log(`User ID: ${user.id}`)
    if (isInvitation) {
      console.log(`Project ID: ${projectId}`)
      console.log(`Subcontractor ID: ${subcontractorId}`)
    }
    console.log('========================================\n')

    // Build redirect URL for invitation flow
    let redirectUrl = '/portal/dashboard'
    if (isInvitation && projectId && subcontractorId) {
      redirectUrl = `/portal/upload?project=${projectId}&subcontractor=${subcontractorId}`
    }

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      redirectUrl,
      isInvitation
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
    console.error('Magic link verify error:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
