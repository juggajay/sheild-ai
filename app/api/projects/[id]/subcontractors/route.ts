import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'
import { sendSubcontractorInvitation } from '@/lib/invitation'

// GET /api/projects/[id]/subcontractors - List subcontractors for a project
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

    // Get subcontractors for this project
    const result = await convex.query(api.projectSubcontractors.getByProjectWithDetails, {
      projectId: id as Id<"projects">,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get project subcontractors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/subcontractors - Add subcontractor to project
export async function POST(
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

    // Only admin, risk_manager, project_manager can add subcontractors
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to add subcontractors' }, { status: 403 })
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

    const body = await request.json()
    const { subcontractorId, onSiteDate } = body

    if (!subcontractorId) {
      return NextResponse.json({ error: 'Subcontractor ID is required' }, { status: 400 })
    }

    // Verify subcontractor exists and belongs to same company
    const subResult = await convex.query(api.projectSubcontractors.validateSubcontractor, {
      subcontractorId: subcontractorId as Id<"subcontractors">,
      companyId: user.companyId,
    })

    if (!subResult.valid) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Check if already assigned
    const existing = await convex.query(api.projectSubcontractors.getByProjectAndSubcontractor, {
      projectId: id as Id<"projects">,
      subcontractorId: subcontractorId as Id<"subcontractors">,
    })

    if (existing) {
      return NextResponse.json({ error: 'Subcontractor is already assigned to this project' }, { status: 400 })
    }

    // Create project_subcontractor assignment
    const projectSubcontractorId = await convex.mutation(api.projectSubcontractors.create, {
      projectId: id as Id<"projects">,
      subcontractorId: subcontractorId as Id<"subcontractors">,
      status: 'pending',
      onSiteDate: onSiteDate ? new Date(onSiteDate).getTime() : undefined,
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.companyId,
      userId: user._id,
      entityType: 'project_subcontractor',
      entityId: projectSubcontractorId,
      action: 'create',
      details: {
        projectId: id,
        subcontractorId
      },
    })

    // Send invitation email (optional - controlled by sendInvitation param)
    const sendInvitation = body.sendInvitation !== false // Default to true
    let invitationSent = false
    let invitationError: string | undefined

    if (sendInvitation) {
      const invitationResult = await sendSubcontractorInvitation(
        id,
        subcontractorId,
        projectSubcontractorId
      )
      invitationSent = invitationResult.success
      if (!invitationResult.success) {
        invitationError = invitationResult.error
        console.warn('Failed to send invitation:', invitationResult.error)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Subcontractor added to project',
      projectSubcontractorId,
      invitationSent,
      invitationError
    }, { status: 201 })

  } catch (error) {
    console.error('Add subcontractor to project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/subcontractors - Remove subcontractor from project
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

    // Only admin, risk_manager, project_manager can remove subcontractors
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to remove subcontractors' }, { status: 403 })
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

    const body = await request.json()
    const { subcontractorId } = body

    if (!subcontractorId) {
      return NextResponse.json({ error: 'Subcontractor ID is required' }, { status: 400 })
    }

    // Find the project_subcontractor record
    const projectSubcontractor = await convex.query(api.projectSubcontractors.getByProjectAndSubcontractor, {
      projectId: id as Id<"projects">,
      subcontractorId: subcontractorId as Id<"subcontractors">,
    })

    if (!projectSubcontractor) {
      return NextResponse.json({ error: 'Subcontractor is not assigned to this project' }, { status: 404 })
    }

    // Get subcontractor name for logging
    const subcontractor = await convex.query(api.subcontractors.getById, {
      id: subcontractorId as Id<"subcontractors">,
    })

    // Delete the assignment (not the subcontractor itself)
    await convex.mutation(api.projectSubcontractors.remove, {
      id: projectSubcontractor._id,
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.companyId,
      userId: user._id,
      entityType: 'project_subcontractor',
      entityId: projectSubcontractor._id,
      action: 'delete',
      details: {
        projectId: id,
        subcontractorId,
        subcontractorName: subcontractor?.name
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Subcontractor removed from project'
    })

  } catch (error) {
    console.error('Remove subcontractor from project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
