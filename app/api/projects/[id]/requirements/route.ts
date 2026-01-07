import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, type Project } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

// Valid coverage types
const VALID_COVERAGE_TYPES = [
  'public_liability',
  'products_liability',
  'workers_comp',
  'professional_indemnity',
  'motor_vehicle',
  'contract_works'
]

// Helper function to check if user can access project
function canAccessProject(user: { id: string; company_id: string | null; role: string }, project: Project): boolean {
  if (project.company_id !== user.company_id) {
    return false
  }

  if (['admin', 'risk_manager', 'read_only'].includes(user.role)) {
    return true
  }

  if (['project_manager', 'project_administrator'].includes(user.role)) {
    return project.project_manager_id === user.id
  }

  return false
}

// GET /api/projects/[id]/requirements - Get project insurance requirements
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id) as Project | undefined

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!canAccessProject(user, project)) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    const requirements = db.prepare('SELECT * FROM insurance_requirements WHERE project_id = ?').all(params.id)

    return NextResponse.json({ requirements })
  } catch (error) {
    console.error('Get requirements error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/requirements - Add insurance requirement
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admin and risk_manager can configure requirements
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins and risk managers can configure requirements' }, { status: 403 })
    }

    const db = getDb()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id) as Project | undefined

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!canAccessProject(user, project)) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    const body = await request.json()
    const {
      coverage_type,
      minimum_limit,
      limit_type,
      maximum_excess,
      principal_indemnity_required,
      cross_liability_required,
      waiver_of_subrogation_required,
      principal_naming_required,
      other_requirements
    } = body

    // Validate coverage type
    if (!coverage_type || !VALID_COVERAGE_TYPES.includes(coverage_type)) {
      return NextResponse.json({
        error: `Invalid coverage type. Must be one of: ${VALID_COVERAGE_TYPES.join(', ')}`
      }, { status: 400 })
    }

    // Check if this coverage type already exists for the project
    const existing = db.prepare(
      'SELECT id FROM insurance_requirements WHERE project_id = ? AND coverage_type = ?'
    ).get(params.id, coverage_type)

    if (existing) {
      return NextResponse.json({
        error: 'This coverage type already exists for this project. Use PUT to update.'
      }, { status: 409 })
    }

    // Create requirement
    const requirementId = uuidv4()

    db.prepare(`
      INSERT INTO insurance_requirements (
        id, project_id, coverage_type, minimum_limit, limit_type,
        maximum_excess, principal_indemnity_required, cross_liability_required,
        waiver_of_subrogation_required, principal_naming_required, other_requirements
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requirementId,
      params.id,
      coverage_type,
      minimum_limit || null,
      limit_type || 'per_occurrence',
      maximum_excess || null,
      principal_indemnity_required ? 1 : 0,
      cross_liability_required ? 1 : 0,
      waiver_of_subrogation_required ? 1 : 0,
      principal_naming_required || null,
      other_requirements || null
    )

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'insurance_requirement', ?, 'create', ?)
    `).run(uuidv4(), user.company_id, user.id, requirementId, JSON.stringify({
      project_id: params.id,
      coverage_type,
      minimum_limit
    }))

    // Get created requirement
    const requirement = db.prepare('SELECT * FROM insurance_requirements WHERE id = ?').get(requirementId)

    return NextResponse.json({
      success: true,
      message: 'Insurance requirement added',
      requirement
    }, { status: 201 })

  } catch (error) {
    console.error('Create requirement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/projects/[id]/requirements - Update insurance requirements (bulk)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admin and risk_manager can configure requirements
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins and risk managers can configure requirements' }, { status: 403 })
    }

    const db = getDb()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id) as Project | undefined

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!canAccessProject(user, project)) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    const body = await request.json()
    const { requirements } = body

    if (!Array.isArray(requirements)) {
      return NextResponse.json({ error: 'Requirements must be an array' }, { status: 400 })
    }

    // Validate all requirements
    for (const req of requirements) {
      if (!req.coverage_type || !VALID_COVERAGE_TYPES.includes(req.coverage_type)) {
        return NextResponse.json({
          error: `Invalid coverage type: ${req.coverage_type}. Must be one of: ${VALID_COVERAGE_TYPES.join(', ')}`
        }, { status: 400 })
      }
    }

    // Delete existing requirements and insert new ones (transaction-like)
    db.prepare('DELETE FROM insurance_requirements WHERE project_id = ?').run(params.id)

    for (const req of requirements) {
      const requirementId = uuidv4()
      db.prepare(`
        INSERT INTO insurance_requirements (
          id, project_id, coverage_type, minimum_limit, limit_type,
          maximum_excess, principal_indemnity_required, cross_liability_required,
          waiver_of_subrogation_required, principal_naming_required, other_requirements
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        requirementId,
        params.id,
        req.coverage_type,
        req.minimum_limit || null,
        req.limit_type || 'per_occurrence',
        req.maximum_excess || null,
        req.principal_indemnity_required ? 1 : 0,
        req.cross_liability_required ? 1 : 0,
        req.waiver_of_subrogation_required ? 1 : 0,
        req.principal_naming_required || null,
        req.other_requirements || null
      )
    }

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'project', ?, 'update_requirements', ?)
    `).run(uuidv4(), user.company_id, user.id, params.id, JSON.stringify({
      requirements_count: requirements.length
    }))

    // Get updated requirements
    const updatedRequirements = db.prepare('SELECT * FROM insurance_requirements WHERE project_id = ?').all(params.id)

    return NextResponse.json({
      success: true,
      message: 'Insurance requirements updated',
      requirements: updatedRequirements
    })

  } catch (error) {
    console.error('Update requirements error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
