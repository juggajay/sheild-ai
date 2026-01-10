import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'

// GET /api/projects/[id] - Get project details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    const { id } = await params

    // Validate access to project
    const accessResult = await convex.query(api.projects.validateAccess, {
      projectId: id as Id<"projects">,
      userId: user._id,
      userRole: user.role,
      userCompanyId: user.companyId,
    })

    if (!accessResult.canAccess) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    // Get project with full details
    const result = await convex.query(api.projects.getByIdWithDetails, {
      id: id as Id<"projects">,
    })

    if (!result) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/projects/[id] - Update project
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    // Only admin and risk_manager can update projects
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins and risk managers can update projects' }, { status: 403 })
    }

    const { id } = await params

    // Validate access to project
    const accessResult = await convex.query(api.projects.validateAccess, {
      projectId: id as Id<"projects">,
      userId: user._id,
      userRole: user.role,
      userCompanyId: user.companyId,
    })

    if (!accessResult.canAccess || !accessResult.project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const project = accessResult.project
    const body = await request.json()
    const { name, address, state, startDate, endDate, estimatedValue, projectManagerId, status, updatedAt } = body

    // Optimistic concurrency check - if client provides updatedAt, verify it matches
    if (updatedAt && project.updatedAt && project.updatedAt !== updatedAt) {
      return NextResponse.json({
        error: 'This project was modified by another user. Please refresh and try again.',
        code: 'CONCURRENT_MODIFICATION'
      }, { status: 409 })
    }

    // Validate state if provided
    const validStates = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT']
    if (state && !validStates.includes(state)) {
      return NextResponse.json({ error: `Invalid state. Must be one of: ${validStates.join(', ')}` }, { status: 400 })
    }

    // Validate status if provided
    const validStatuses = ['active', 'completed', 'on_hold']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    // Validate project manager exists if provided
    if (projectManagerId) {
      const isValidPM = await convex.query(api.projects.validateProjectManager, {
        projectManagerId: projectManagerId as Id<"users">,
        companyId: user.companyId,
      })
      if (!isValidPM) {
        return NextResponse.json({ error: 'Project manager not found' }, { status: 400 })
      }
    }

    // Update project
    await convex.mutation(api.projects.update, {
      id: id as Id<"projects">,
      name: name?.trim() || undefined,
      address: address?.trim() || undefined,
      state: state || undefined,
      startDate: startDate ? new Date(startDate).getTime() : undefined,
      endDate: endDate ? new Date(endDate).getTime() : undefined,
      estimatedValue: estimatedValue || undefined,
      projectManagerId: projectManagerId as Id<"users"> || undefined,
      status: status || undefined,
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.companyId,
      userId: user._id,
      entityType: 'project',
      entityId: id,
      action: 'update',
      details: { name, state, status },
    })

    // Get updated project
    const updatedProject = await convex.query(api.projects.getById, {
      id: id as Id<"projects">,
    })

    return NextResponse.json({
      success: true,
      message: 'Project updated successfully',
      project: updatedProject
    })

  } catch (error) {
    console.error('Update project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id] - Archive project (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    // Only admin can delete projects
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete projects' }, { status: 403 })
    }

    const { id } = await params

    // Validate access to project
    const accessResult = await convex.query(api.projects.validateAccess, {
      projectId: id as Id<"projects">,
      userId: user._id,
      userRole: user.role,
      userCompanyId: user.companyId,
    })

    if (!accessResult.canAccess || !accessResult.project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const project = accessResult.project

    // Archive the project (set status to completed)
    await convex.mutation(api.projects.update, {
      id: id as Id<"projects">,
      status: 'completed',
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.companyId,
      userId: user._id,
      entityType: 'project',
      entityId: id,
      action: 'archive',
      details: { name: project.name },
    })

    return NextResponse.json({
      success: true,
      message: 'Project archived successfully'
    })

  } catch (error) {
    console.error('Delete project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
