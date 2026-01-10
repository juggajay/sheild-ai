import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination'

// GET /api/projects - List projects (filtered by role)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const { page, limit, offset } = parsePaginationParams(searchParams)

    // Get paginated projects with role-based filtering
    const result = await convex.query(api.projects.listPaginated, {
      companyId: user.companyId,
      userId: user._id,
      userRole: user.role,
      includeArchived,
      limit,
      cursor: offset > 0 ? String(offset) : undefined,
    })

    // Return both old format (projects array) for backward compatibility
    // and new paginated format
    const paginatedResponse = createPaginatedResponse(result.projects, result.total, { page, limit, offset })
    return NextResponse.json({
      projects: result.projects,  // Backward compatibility
      ...paginatedResponse  // New pagination structure
    })
  } catch (error) {
    console.error('Get projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
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

    // Only admin and risk_manager can create projects
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins and risk managers can create projects' }, { status: 403 })
    }

    const body = await request.json()
    const { name, address, state, startDate, endDate, estimatedValue, projectManagerId } = body

    // Field length constraints
    const NAME_MIN_LENGTH = 2
    const NAME_MAX_LENGTH = 200
    const ADDRESS_MAX_LENGTH = 500

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    // Validate name length
    const trimmedName = name.trim()
    if (trimmedName.length < NAME_MIN_LENGTH) {
      return NextResponse.json({
        error: `Project name must be at least ${NAME_MIN_LENGTH} characters`
      }, { status: 400 })
    }
    if (name.length > NAME_MAX_LENGTH) {
      return NextResponse.json({
        error: `Project name must not exceed ${NAME_MAX_LENGTH} characters`
      }, { status: 400 })
    }

    // Validate address length if provided
    if (address && address.length > ADDRESS_MAX_LENGTH) {
      return NextResponse.json({
        error: `Address must not exceed ${ADDRESS_MAX_LENGTH} characters`
      }, { status: 400 })
    }

    // Validate state if provided
    const validStates = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT']
    if (state && !validStates.includes(state)) {
      return NextResponse.json({ error: `Invalid state. Must be one of: ${validStates.join(', ')}` }, { status: 400 })
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

    // Generate forwarding email
    const projectIdPrefix = crypto.randomUUID().split('-')[0]
    const forwardingEmail = `coc-${projectIdPrefix}@riskshield.ai`

    // Create project
    const projectId = await convex.mutation(api.projects.create, {
      companyId: user.companyId,
      name: trimmedName,
      address: address?.trim() || undefined,
      state: state || undefined,
      startDate: startDate ? new Date(startDate).getTime() : undefined,
      endDate: endDate ? new Date(endDate).getTime() : undefined,
      estimatedValue: estimatedValue || undefined,
      projectManagerId: projectManagerId as Id<"users"> || undefined,
      forwardingEmail,
      status: 'active',
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.companyId,
      userId: user._id,
      entityType: 'project',
      entityId: projectId,
      action: 'create',
      details: { name: trimmedName, state },
    })

    // Get the created project
    const project = await convex.query(api.projects.getById, { id: projectId })

    return NextResponse.json({
      success: true,
      message: 'Project created successfully',
      project
    }, { status: 201 })

  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
