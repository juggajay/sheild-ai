import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, type Project } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

// Helper function to check if user has access to project
function canAccessProject(user: { id: string; company_id: string | null; role: string }, project: Project): boolean {
  // Must be same company
  if (project.company_id !== user.company_id) {
    return false
  }

  // Admin, risk_manager, and read_only can access all company projects
  if (['admin', 'risk_manager', 'read_only'].includes(user.role)) {
    return true
  }

  // Project manager and project administrator can only access assigned projects
  if (['project_manager', 'project_administrator'].includes(user.role)) {
    return project.project_manager_id === user.id
  }

  return false
}

// GET /api/projects/[id]/subcontractors - List subcontractors for a project
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

    // Check access
    if (!canAccessProject(user, project)) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    // Get subcontractors for this project
    const subcontractors = db.prepare(`
      SELECT
        ps.id as project_subcontractor_id,
        ps.status,
        ps.on_site_date,
        ps.created_at as assigned_at,
        s.*
      FROM project_subcontractors ps
      JOIN subcontractors s ON ps.subcontractor_id = s.id
      WHERE ps.project_id = ?
      ORDER BY s.name
    `).all(params.id)

    return NextResponse.json({
      subcontractors,
      total: subcontractors.length
    })
  } catch (error) {
    console.error('Get project subcontractors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/subcontractors - Add subcontractor to project
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

    // Only admin, risk_manager, project_manager can add subcontractors
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to add subcontractors' }, { status: 403 })
    }

    const db = getDb()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id) as Project | undefined

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check access
    if (!canAccessProject(user, project)) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    const body = await request.json()
    const { subcontractorId, onSiteDate } = body

    if (!subcontractorId) {
      return NextResponse.json({ error: 'Subcontractor ID is required' }, { status: 400 })
    }

    // Verify subcontractor exists and belongs to same company
    const subcontractor = db.prepare('SELECT * FROM subcontractors WHERE id = ? AND company_id = ?').get(subcontractorId, user.company_id)
    if (!subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Check if already assigned
    const existing = db.prepare('SELECT id FROM project_subcontractors WHERE project_id = ? AND subcontractor_id = ?').get(params.id, subcontractorId)
    if (existing) {
      return NextResponse.json({ error: 'Subcontractor is already assigned to this project' }, { status: 400 })
    }

    // Create project_subcontractor assignment
    const projectSubcontractorId = uuidv4()
    db.prepare(`
      INSERT INTO project_subcontractors (id, project_id, subcontractor_id, status, on_site_date)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(projectSubcontractorId, params.id, subcontractorId, onSiteDate || null)

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'project_subcontractor', ?, 'create', ?)
    `).run(uuidv4(), user.company_id, user.id, projectSubcontractorId, JSON.stringify({
      projectId: params.id,
      subcontractorId
    }))

    return NextResponse.json({
      success: true,
      message: 'Subcontractor added to project',
      projectSubcontractorId
    }, { status: 201 })

  } catch (error) {
    console.error('Add subcontractor to project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/subcontractors - Remove subcontractor from project
export async function DELETE(
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

    // Only admin, risk_manager, project_manager can remove subcontractors
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to remove subcontractors' }, { status: 403 })
    }

    const db = getDb()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id) as Project | undefined

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check access
    if (!canAccessProject(user, project)) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    const body = await request.json()
    const { subcontractorId } = body

    if (!subcontractorId) {
      return NextResponse.json({ error: 'Subcontractor ID is required' }, { status: 400 })
    }

    // Find the project_subcontractor record
    const projectSubcontractor = db.prepare(`
      SELECT ps.id, s.name as subcontractor_name
      FROM project_subcontractors ps
      JOIN subcontractors s ON ps.subcontractor_id = s.id
      WHERE ps.project_id = ? AND ps.subcontractor_id = ?
    `).get(params.id, subcontractorId) as { id: string; subcontractor_name: string } | undefined

    if (!projectSubcontractor) {
      return NextResponse.json({ error: 'Subcontractor is not assigned to this project' }, { status: 404 })
    }

    // Delete the assignment (not the subcontractor itself)
    db.prepare('DELETE FROM project_subcontractors WHERE id = ?').run(projectSubcontractor.id)

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'project_subcontractor', ?, 'delete', ?)
    `).run(uuidv4(), user.company_id, user.id, projectSubcontractor.id, JSON.stringify({
      projectId: params.id,
      subcontractorId,
      subcontractorName: projectSubcontractor.subcontractor_name
    }))

    return NextResponse.json({
      success: true,
      message: 'Subcontractor removed from project'
    })

  } catch (error) {
    console.error('Remove subcontractor from project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
