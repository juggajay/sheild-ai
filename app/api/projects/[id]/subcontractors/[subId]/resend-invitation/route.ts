import { NextRequest, NextResponse } from 'next/server'
import { getDb, type Project } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'
import { resendInvitation } from '@/lib/invitation'

// Helper function to check if user has access to project
function canAccessProject(user: { id: string; company_id: string | null; role: string }, project: Project): boolean {
  if (project.company_id !== user.company_id) {
    return false
  }

  if (['admin', 'risk_manager'].includes(user.role)) {
    return true
  }

  if (['project_manager', 'project_administrator'].includes(user.role)) {
    return project.project_manager_id === user.id
  }

  return false
}

// POST /api/projects/[id]/subcontractors/[subId]/resend-invitation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; subId: string } }
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

    // Only admin, risk_manager, project_manager can resend invitations
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to resend invitations' }, { status: 403 })
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

    // Find the project-subcontractor assignment
    const assignment = db.prepare(`
      SELECT ps.id, ps.subcontractor_id, s.contact_email
      FROM project_subcontractors ps
      JOIN subcontractors s ON ps.subcontractor_id = s.id
      WHERE ps.project_id = ? AND ps.subcontractor_id = ?
    `).get(params.id, params.subId) as {
      id: string
      subcontractor_id: string
      contact_email: string | null
    } | undefined

    if (!assignment) {
      return NextResponse.json({ error: 'Subcontractor is not assigned to this project' }, { status: 404 })
    }

    if (!assignment.contact_email) {
      return NextResponse.json({ error: 'Subcontractor has no contact email' }, { status: 400 })
    }

    // Resend the invitation
    const result = await resendInvitation(assignment.id)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to resend invitation' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation resent successfully',
      email: assignment.contact_email
    })

  } catch (error) {
    console.error('Resend invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
