import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, isProduction, getSupabase } from '@/lib/db'
import { getUserByToken, getUserByTokenAsync } from '@/lib/auth'
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination'

// GET /api/projects - List projects (filtered by role)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = isProduction ? await getUserByTokenAsync(token) : getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const { page, limit, offset } = parsePaginationParams(searchParams)

    let projects: any[]
    let total: number

    if (isProduction) {
      // Production: Use Supabase
      const supabase = getSupabase()
      const isFullAccess = ['admin', 'risk_manager', 'read_only'].includes(user.role)

      let query = supabase
        .from('projects')
        .select('*, users!projects_project_manager_id_fkey(name)', { count: 'exact' })
        .eq('company_id', user.company_id)

      if (!includeArchived) {
        query = query.neq('status', 'completed')
      }

      if (!isFullAccess) {
        query = query.eq('project_manager_id', user.id)
      }

      query = query.order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      // Get subcontractor counts for each project
      const projectIds = (data || []).map((p: any) => p.id)
      const { data: subCounts } = await supabase
        .from('project_subcontractors')
        .select('project_id, status')
        .in('project_id', projectIds)

      const countMap = new Map<string, { total: number; compliant: number }>()
      for (const ps of subCounts || []) {
        if (!countMap.has(ps.project_id)) {
          countMap.set(ps.project_id, { total: 0, compliant: 0 })
        }
        const counts = countMap.get(ps.project_id)!
        counts.total++
        if (ps.status === 'compliant') counts.compliant++
      }

      projects = (data || []).map((p: any) => ({
        ...p,
        project_manager_name: p.users?.name || null,
        subcontractor_count: countMap.get(p.id)?.total || 0,
        compliant_count: countMap.get(p.id)?.compliant || 0
      }))
      total = count || 0

    } else {
      // Development: Use SQLite
      const db = getDb()

      // Role-based filtering:
      // - admin, risk_manager: Can see all company projects
      // - project_manager, project_administrator: Can only see assigned projects
      // - read_only: Can see all company projects (read-only)

      if (['admin', 'risk_manager', 'read_only'].includes(user.role)) {
        // Full access to all company projects
        const statusFilter = includeArchived ? '' : "AND p.status != 'completed'"

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
        const statusFilter = includeArchived ? '' : "AND p.status != 'completed'"

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

    const user = isProduction ? await getUserByTokenAsync(token) : getUserByToken(token)
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

    const projectId = uuidv4()
    const forwardingEmail = `coc-${projectId.split('-')[0]}@riskshield.ai`
    let project

    if (isProduction) {
      // Production: Use Supabase
      const supabase = getSupabase()

      // Validate project manager exists if provided
      if (projectManagerId) {
        const { data: pm } = await supabase.from('users').select('id').eq('id', projectManagerId).eq('company_id', user.company_id).single()
        if (!pm) {
          return NextResponse.json({ error: 'Project manager not found' }, { status: 400 })
        }
      }

      const { data, error } = await supabase.from('projects').insert({
        id: projectId,
        company_id: user.company_id,
        name: name.trim(),
        address: address?.trim() || null,
        state: state || null,
        start_date: startDate || null,
        end_date: endDate || null,
        estimated_value: estimatedValue || null,
        project_manager_id: projectManagerId || null,
        forwarding_email: forwardingEmail,
        status: 'active'
      }).select().single()

      if (error) throw error
      project = data

      await supabase.from('audit_logs').insert({
        id: uuidv4(),
        company_id: user.company_id,
        user_id: user.id,
        entity_type: 'project',
        entity_id: projectId,
        action: 'create',
        details: { name: name.trim(), state }
      })
    } else {
      // Development: Use SQLite
      const db = getDb()

      if (projectManagerId) {
        const pm = db.prepare('SELECT id FROM users WHERE id = ? AND company_id = ?').get(projectManagerId, user.company_id)
        if (!pm) {
          return NextResponse.json({ error: 'Project manager not found' }, { status: 400 })
        }
      }

      db.prepare(`
        INSERT INTO projects (id, company_id, name, address, state, start_date, end_date, estimated_value, project_manager_id, forwarding_email, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(projectId, user.company_id, name.trim(), address?.trim() || null, state || null, startDate || null, endDate || null, estimatedValue || null, projectManagerId || null, forwardingEmail)

      db.prepare(`
        INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
        VALUES (?, ?, ?, 'project', ?, 'create', ?)
      `).run(uuidv4(), user.company_id, user.id, projectId, JSON.stringify({ name: name.trim(), state }))

      project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
    }

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
