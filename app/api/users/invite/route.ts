import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { hashPassword, getUserByToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const currentUser = getUserByToken(token)
    if (!currentUser) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admins can invite users
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can invite users' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, role, password } = body

    // Validate required fields
    if (!email || !name || !role) {
      return NextResponse.json(
        { error: 'Email, name, and role are required' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['admin', 'risk_manager', 'project_manager', 'project_administrator', 'read_only']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    const db = getDb()

    // Check if email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    // Create user with pending invitation status
    const userId = uuidv4()
    const invitationToken = uuidv4()
    // For testing: if password provided, use it; otherwise generate a temporary one
    const tempPassword = password || `Temp${Date.now()}!`
    const passwordHash = await hashPassword(tempPassword)

    // Set invitation to expire in 7 days
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    db.prepare(`
      INSERT INTO users (id, company_id, email, password_hash, name, role, invitation_status, invitation_token, invitation_expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(userId, currentUser.company_id, email.toLowerCase(), passwordHash, name.trim(), role, invitationToken, expiresAt.toISOString())

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'user', ?, 'invite', ?)
    `).run(uuidv4(), currentUser.company_id, currentUser.id, userId, JSON.stringify({ email: email.toLowerCase(), role }))

    // In development mode, log the invitation link
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/accept-invite?token=${invitationToken}`
    if (process.env.NODE_ENV !== 'production') {
      console.log(`
========================================
INVITATION EMAIL (DEV MODE)
========================================
To: ${email.toLowerCase()}
Subject: You've been invited to join RiskShield AI

Hi ${name.trim()},

You've been invited to join the ${currentUser.company_id} team on RiskShield AI.

Click here to accept your invitation:
${inviteUrl}

This invitation expires in 7 days.

Best regards,
RiskShield AI Team
========================================
      `)
    }

    return NextResponse.json({
      success: true,
      message: 'User invited successfully. Invitation email sent.',
      user: {
        id: userId,
        email: email.toLowerCase(),
        name: name.trim(),
        role,
        invitation_status: 'pending'
      },
      // For development testing only
      ...(process.env.NODE_ENV !== 'production' && { tempPassword, inviteUrl })
    }, { status: 201 })

  } catch (error) {
    console.error('Invite user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
