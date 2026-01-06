import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

interface DbUser {
  id: string
  email: string
  name: string
  role: string
  phone: string | null
  avatar_url: string | null
  company_id: string
  last_login_at: string | null
  created_at: string
  invitation_status: string | null
}

// GET /api/users/[id] - Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const currentUser = getUserByToken(token)
    if (!currentUser) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admins can view user details
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can view user details' }, { status: 403 })
    }

    const db = getDb()
    const user = db.prepare(`
      SELECT id, email, name, role, phone, avatar_url, company_id, last_login_at, created_at, invitation_status
      FROM users
      WHERE id = ? AND company_id = ?
    `).get(params.id, currentUser.company_id) as DbUser | undefined

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/users/[id] - Update user (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const currentUser = getUserByToken(token)
    if (!currentUser) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admins can update users
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can update users' }, { status: 403 })
    }

    const db = getDb()

    // Check if user exists and belongs to the same company
    const existingUser = db.prepare(`
      SELECT id, email, name, role, company_id
      FROM users
      WHERE id = ? AND company_id = ?
    `).get(params.id, currentUser.company_id) as DbUser | undefined

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, role, phone } = body

    // Validate role if provided
    if (role) {
      const validRoles = ['admin', 'risk_manager', 'project_manager', 'project_administrator', 'read_only']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        )
      }

      // Prevent demoting yourself if you're the only admin
      if (currentUser.id === params.id && role !== 'admin') {
        const adminCount = db.prepare(`
          SELECT COUNT(*) as count FROM users
          WHERE company_id = ? AND role = 'admin'
        `).get(currentUser.company_id) as { count: number }

        if (adminCount.count <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote yourself - you are the only admin' },
            { status: 400 }
          )
        }
      }
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: (string | null)[] = []

    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name.trim())
    }

    if (role !== undefined) {
      updates.push('role = ?')
      values.push(role)
    }

    if (phone !== undefined) {
      updates.push('phone = ?')
      values.push(phone?.trim() || null)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push("updated_at = datetime('now')")
    values.push(params.id)

    db.prepare(`
      UPDATE users SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values)

    // Log the action
    const details: Record<string, unknown> = {}
    if (name !== undefined) details.name = name
    if (role !== undefined) details.role = role
    if (phone !== undefined) details.phone = phone

    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'user', ?, 'update', ?)
    `).run(uuidv4(), currentUser.company_id, currentUser.id, params.id, JSON.stringify(details))

    // Get updated user
    const updatedUser = db.prepare(`
      SELECT id, email, name, role, phone, avatar_url, last_login_at, created_at, invitation_status
      FROM users
      WHERE id = ?
    `).get(params.id) as DbUser

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/users/[id] - Deactivate user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const currentUser = getUserByToken(token)
    if (!currentUser) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admins can delete users
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete users' }, { status: 403 })
    }

    // Cannot delete yourself
    if (currentUser.id === params.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const db = getDb()

    // Check if user exists and belongs to the same company
    const existingUser = db.prepare(`
      SELECT id, email, name, company_id
      FROM users
      WHERE id = ? AND company_id = ?
    `).get(params.id, currentUser.company_id) as DbUser | undefined

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has created any exceptions (would block deletion)
    const exceptionsCreated = db.prepare('SELECT COUNT(*) as count FROM exceptions WHERE created_by_user_id = ?').get(params.id) as { count: number }
    if (exceptionsCreated.count > 0) {
      return NextResponse.json({ error: 'Cannot delete user who has created exceptions. Transfer ownership first.' }, { status: 400 })
    }

    // Log the action BEFORE deleting (so we have record)
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'user', ?, 'delete', ?)
    `).run(uuidv4(), currentUser.company_id, currentUser.id, params.id, JSON.stringify({
      email: existingUser.email,
      name: existingUser.name
    }))

    // Delete user's sessions first
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(params.id)

    // Set user_id to NULL in audit_logs (preserve audit history)
    db.prepare('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?').run(params.id)

    // Set verified_by_user_id to NULL in verifications
    db.prepare('UPDATE verifications SET verified_by_user_id = NULL WHERE verified_by_user_id = ?').run(params.id)

    // Set approved_by_user_id to NULL in exceptions (created_by_user_id is NOT NULL, checked above)
    db.prepare('UPDATE exceptions SET approved_by_user_id = NULL WHERE approved_by_user_id = ?').run(params.id)

    // Set project_manager_id to NULL in projects
    db.prepare('UPDATE projects SET project_manager_id = NULL WHERE project_manager_id = ?').run(params.id)

    // Delete the user
    db.prepare('DELETE FROM users WHERE id = ?').run(params.id)

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
