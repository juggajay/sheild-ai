import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// GET /api/users/[id] - Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    if (!currentUser.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const user = await convex.query(api.users.getByIdForCompany, {
      id: id as Id<"users">,
      companyId: currentUser.company_id as Id<"companies">,
    })

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    if (!currentUser.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    // Check if user exists and belongs to the same company
    const existingUser = await convex.query(api.users.getByIdForCompany, {
      id: id as Id<"users">,
      companyId: currentUser.company_id as Id<"companies">,
    })

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
      if (currentUser.id === id && role !== 'admin') {
        const adminCount = await convex.query(api.users.countAdmins, {
          companyId: currentUser.company_id as Id<"companies">,
        })

        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote yourself - you are the only admin' },
            { status: 400 }
          )
        }
      }
    }

    // Build update object
    const updates: {
      name?: string
      role?: "admin" | "risk_manager" | "project_manager" | "project_administrator" | "read_only" | "subcontractor" | "broker"
      phone?: string
    } = {}

    if (name !== undefined) {
      updates.name = name.trim()
    }

    if (role !== undefined) {
      updates.role = role
    }

    if (phone !== undefined) {
      updates.phone = phone?.trim() || undefined
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Update the user
    await convex.mutation(api.users.update, {
      id: id as Id<"users">,
      ...updates,
    })

    // Log the action
    const details: Record<string, unknown> = {}
    if (name !== undefined) details.name = name
    if (role !== undefined) details.role = role
    if (phone !== undefined) details.phone = phone

    await convex.mutation(api.auditLogs.create, {
      companyId: currentUser.company_id as Id<"companies">,
      userId: currentUser.id as Id<"users">,
      entityType: 'user',
      entityId: id,
      action: 'update',
      details,
    })

    // Get updated user
    const updatedUser = await convex.query(api.users.getByIdForCompany, {
      id: id as Id<"users">,
      companyId: currentUser.company_id as Id<"companies">,
    })

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser,
    })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/users/[id] - Deactivate user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    if (currentUser.id === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    if (!currentUser.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    // Check if user exists and belongs to the same company
    const existingUser = await convex.query(api.users.getByIdForCompany, {
      id: id as Id<"users">,
      companyId: currentUser.company_id as Id<"companies">,
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has created any exceptions (would block deletion)
    const hasExceptions = await convex.query(api.users.hasCreatedExceptions, {
      userId: id as Id<"users">,
    })

    if (hasExceptions) {
      return NextResponse.json(
        { error: 'Cannot delete user who has created exceptions. Transfer ownership first.' },
        { status: 400 }
      )
    }

    // Log the action BEFORE deleting (so we have record)
    await convex.mutation(api.auditLogs.create, {
      companyId: currentUser.company_id as Id<"companies">,
      userId: currentUser.id as Id<"users">,
      entityType: 'user',
      entityId: id,
      action: 'delete',
      details: {
        email: existingUser.email,
        name: existingUser.name,
      },
    })

    // Delete user with cascade (handles sessions, nullifies references)
    await convex.mutation(api.users.removeWithCascade, {
      id: id as Id<"users">,
    })

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
