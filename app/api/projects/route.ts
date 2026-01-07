import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination'

// GET /api/projects - List projects (filtered by role)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const db = getDb()

    // Role-based filtering:
    // - admin, risk_manager: Can see all company projects
    // - project_manager, project_administrator: Can only see assigned projects
    // - read_only: Can see all company projects (read-only)

    // Check if archived/completed projects should be included
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const { page, limit, offset } = parsePaginationParams(searchParams)

    let projects
    let total: number

    if (['admin', 'risk_manager', 'read_only'].includes(user.role)) {
      // Full access to all company projects
      // By default, exclude completed/archived projects
      const statusFilter = includeArchived ? '' : "AND p.status != 'completed'"

      // Get total count first
      const countResult = db.prepare(`
        SELECT COUNT(*) as total FROM projects p
        WHERE p.company_id = ? ${statusFilter}
      `).get(user.company_id) as { total: number }
      total = countResult.total

      projects = db.prepare(`
        SELECT
          p.*,
          u.name as project_manager_name,
          (SELECT COUNT(*) FROM project_subcontractors ps WHERE ps.project_id = p.id) as subcontractor_count,
          (SELECT COUNT(*) FROM project_subcontractors ps WHERE ps.project_id = p.id AND ps.status = 'compliant') as compliant_count
        FROM projects p
        LEFT JOIN users u ON p.project_manager_id = u.id
        WHERE p.company_id = ? ${statusFilter}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `).all(user.company_id, limit, offset)
    } else {
      // Project manager and project administrator: only assigned projects
      // By default, exclude completed/archived projects
      const statusFilter = includeArchived ? '' : "AND p.status != 'completed'"

      // Get total count first
      const countResult = db.prepare(`
        SELECT COUNT(*) as total FROM projects p
        WHERE p.company_id = ? AND p.project_manager_id = ? ${statusFilter}
      `).get(user.company_id, user.id) as { total: number }
      total = countResult.total

      projects = db.prepare(`
        SELECT
          p.*,
          u.name as project_manager_name,
          (SELECT COUNT(*) FROM project_subcontractors ps WHERE ps.project_id = p.id) as subcontractor_count,
          (SELECT COUNT(*) FROM project_subcontractors ps WHERE ps.project_id = p.id AND ps.status = 'compliant') as compliant_count
        FROM projects p
        LEFT JOIN users u ON p.project_manager_id = u.id
        WHERE p.company_id = ? AND p.project_manager_id = ? ${statusFilter}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `).all(user.company_id, user.id, limit, offset)
    }

    // Return both old format (projects array) for backward compatibility
    // and new paginated format
    const paginatedResponse = createPaginatedResponse(projects, total, { page, limit, offset })
    return NextResponse.json({
      projects,  // Backward compatibility
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

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
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

    const db = getDb()

    // Validate project manager exists if provided
    if (projectManagerId) {
      const pm = db.prepare('SELECT id FROM users WHERE id = ? AND company_id = ?').get(projectManagerId, user.company_id)
      if (!pm) {
        return NextResponse.json({ error: 'Project manager not found' }, { status: 400 })
      }
    }

    // Create project
    const projectId = uuidv4()
    const forwardingEmail = `coc-${projectId.split('-')[0]}@riskshield.ai`

    db.prepare(`
      INSERT INTO projects (id, company_id, name, address, state, start_date, end_date, estimated_value, project_manager_id, forwarding_email, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      projectId,
      user.company_id,
      name.trim(),
      address?.trim() || null,
      state || null,
      startDate || null,
      endDate || null,
      estimatedValue || null,
      projectManagerId || null,
      forwardingEmail
    )

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'project', ?, 'create', ?)
    `).run(uuidv4(), user.company_id, user.id, projectId, JSON.stringify({ name: name.trim(), state }))

    // Get created project
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)

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
