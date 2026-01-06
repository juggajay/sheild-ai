import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken, verifyPassword } from '@/lib/auth'

// GET /api/exceptions - List all exceptions for the company
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

    // Get exceptions based on user role
    let exceptions
    if (['admin', 'risk_manager'].includes(user.role)) {
      // Admin and risk_manager see all company exceptions
      exceptions = db.prepare(`
        SELECT e.*,
          ps.subcontractor_id,
          ps.project_id,
          s.name as subcontractor_name,
          p.name as project_name,
          creator.name as created_by_name,
          approver.name as approved_by_name
        FROM exceptions e
        JOIN project_subcontractors ps ON e.project_subcontractor_id = ps.id
        JOIN subcontractors s ON ps.subcontractor_id = s.id
        JOIN projects p ON ps.project_id = p.id
        JOIN users creator ON e.created_by_user_id = creator.id
        LEFT JOIN users approver ON e.approved_by_user_id = approver.id
        WHERE p.company_id = ?
        ORDER BY e.created_at DESC
      `).all(user.company_id)
    } else if (['project_manager', 'project_administrator'].includes(user.role)) {
      // Project managers only see exceptions for their assigned projects
      exceptions = db.prepare(`
        SELECT e.*,
          ps.subcontractor_id,
          ps.project_id,
          s.name as subcontractor_name,
          p.name as project_name,
          creator.name as created_by_name,
          approver.name as approved_by_name
        FROM exceptions e
        JOIN project_subcontractors ps ON e.project_subcontractor_id = ps.id
        JOIN subcontractors s ON ps.subcontractor_id = s.id
        JOIN projects p ON ps.project_id = p.id
        JOIN users creator ON e.created_by_user_id = creator.id
        LEFT JOIN users approver ON e.approved_by_user_id = approver.id
        WHERE p.company_id = ? AND p.project_manager_id = ?
        ORDER BY e.created_at DESC
      `).all(user.company_id, user.id)
    } else {
      // Read-only users see all company exceptions
      exceptions = db.prepare(`
        SELECT e.*,
          ps.subcontractor_id,
          ps.project_id,
          s.name as subcontractor_name,
          p.name as project_name,
          creator.name as created_by_name,
          approver.name as approved_by_name
        FROM exceptions e
        JOIN project_subcontractors ps ON e.project_subcontractor_id = ps.id
        JOIN subcontractors s ON ps.subcontractor_id = s.id
        JOIN projects p ON ps.project_id = p.id
        JOIN users creator ON e.created_by_user_id = creator.id
        LEFT JOIN users approver ON e.approved_by_user_id = approver.id
        WHERE p.company_id = ?
        ORDER BY e.created_at DESC
      `).all(user.company_id)
    }

    return NextResponse.json({
      exceptions,
      total: exceptions.length
    })
  } catch (error) {
    console.error('Get exceptions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/exceptions - Create a new exception
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

    // Only admin, risk_manager, and project_manager can create exceptions
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to create exceptions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      projectSubcontractorId,
      verificationId,
      issueSummary,
      reason,
      riskLevel,
      expirationType,
      expiresAt,
      password // Required for permanent exceptions
    } = body

    // Validate required fields
    if (!projectSubcontractorId || !issueSummary || !reason) {
      return NextResponse.json({ error: 'Project subcontractor ID, issue summary, and reason are required' }, { status: 400 })
    }

    // Validate expiration type
    const validExpirationTypes = ['until_resolved', 'fixed_duration', 'specific_date', 'permanent']
    if (expirationType && !validExpirationTypes.includes(expirationType)) {
      return NextResponse.json({ error: 'Invalid expiration type' }, { status: 400 })
    }

    // SECURITY: Permanent exceptions require password confirmation
    if (expirationType === 'permanent') {
      if (!password) {
        return NextResponse.json({
          error: 'Password confirmation required for permanent exceptions',
          requiresPassword: true
        }, { status: 400 })
      }

      // Verify password
      const db = getDb()
      const userWithPassword = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string } | undefined

      if (!userWithPassword) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const passwordValid = await verifyPassword(password, userWithPassword.password_hash)
      if (!passwordValid) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
      }
    }

    const db = getDb()

    // Verify project_subcontractor exists and user has access
    const projectSubcontractor = db.prepare(`
      SELECT ps.*, p.company_id, p.project_manager_id
      FROM project_subcontractors ps
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.id = ?
    `).get(projectSubcontractorId) as {
      id: string
      project_id: string
      subcontractor_id: string
      company_id: string
      project_manager_id: string | null
    } | undefined

    if (!projectSubcontractor) {
      return NextResponse.json({ error: 'Project subcontractor not found' }, { status: 404 })
    }

    if (projectSubcontractor.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Project managers can only create exceptions for their assigned projects
    if (user.role === 'project_manager' && projectSubcontractor.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'You can only create exceptions for your assigned projects' }, { status: 403 })
    }

    // Create exception
    const exceptionId = uuidv4()
    const validRiskLevels = ['low', 'medium', 'high']
    const finalRiskLevel = riskLevel && validRiskLevels.includes(riskLevel) ? riskLevel : 'medium'

    // Risk managers auto-approve their own exceptions
    const autoApproved = ['admin', 'risk_manager'].includes(user.role)
    const status = autoApproved ? 'active' : 'pending_approval'

    db.prepare(`
      INSERT INTO exceptions (
        id, project_subcontractor_id, verification_id, issue_summary, reason,
        risk_level, created_by_user_id, approved_by_user_id, approved_at,
        expires_at, expiration_type, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      exceptionId,
      projectSubcontractorId,
      verificationId || null,
      issueSummary.trim(),
      reason.trim(),
      finalRiskLevel,
      user.id,
      autoApproved ? user.id : null,
      autoApproved ? new Date().toISOString() : null,
      expiresAt || null,
      expirationType || 'until_resolved',
      status
    )

    // If exception is auto-approved (active), update project_subcontractor status to 'exception'
    if (autoApproved) {
      db.prepare(`
        UPDATE project_subcontractors
        SET status = 'exception', updated_at = datetime('now')
        WHERE id = ?
      `).run(projectSubcontractorId)
    }

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'exception', ?, 'create', ?)
    `).run(
      uuidv4(),
      user.company_id,
      user.id,
      exceptionId,
      JSON.stringify({
        issueSummary: issueSummary.trim(),
        riskLevel: finalRiskLevel,
        expirationType: expirationType || 'until_resolved',
        permanent: expirationType === 'permanent'
      })
    )

    // Get the created exception with full details
    const exception = db.prepare(`
      SELECT e.*,
        ps.subcontractor_id,
        ps.project_id,
        s.name as subcontractor_name,
        p.name as project_name,
        creator.name as created_by_name
      FROM exceptions e
      JOIN project_subcontractors ps ON e.project_subcontractor_id = ps.id
      JOIN subcontractors s ON ps.subcontractor_id = s.id
      JOIN projects p ON ps.project_id = p.id
      JOIN users creator ON e.created_by_user_id = creator.id
      WHERE e.id = ?
    `).get(exceptionId)

    return NextResponse.json({
      success: true,
      message: `Exception ${autoApproved ? 'created and approved' : 'created and pending approval'}`,
      exception
    }, { status: 201 })

  } catch (error) {
    console.error('Create exception error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/exceptions - Approve or reject an exception
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admin and risk_manager can approve exceptions
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to approve exceptions' }, { status: 403 })
    }

    const body = await request.json()
    const { exceptionId, action } = body

    if (!exceptionId) {
      return NextResponse.json({ error: 'Exception ID is required' }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be approve or reject' }, { status: 400 })
    }

    const db = getDb()

    // Get exception with company verification
    const exception = db.prepare(`
      SELECT e.*, ps.id as project_subcontractor_id, p.company_id
      FROM exceptions e
      JOIN project_subcontractors ps ON e.project_subcontractor_id = ps.id
      JOIN projects p ON ps.project_id = p.id
      WHERE e.id = ?
    `).get(exceptionId) as {
      id: string
      status: string
      project_subcontractor_id: string
      company_id: string
    } | undefined

    if (!exception) {
      return NextResponse.json({ error: 'Exception not found' }, { status: 404 })
    }

    if (exception.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (exception.status !== 'pending_approval') {
      return NextResponse.json({ error: 'Exception is not pending approval' }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'active' : 'rejected'

    // Update exception status
    db.prepare(`
      UPDATE exceptions
      SET status = ?, approved_by_user_id = ?, approved_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, user.id, exceptionId)

    // If approved, update project_subcontractor status to 'exception'
    if (action === 'approve') {
      db.prepare(`
        UPDATE project_subcontractors
        SET status = 'exception', updated_at = datetime('now')
        WHERE id = ?
      `).run(exception.project_subcontractor_id)
    }

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'exception', ?, ?, ?)
    `).run(
      uuidv4(),
      user.company_id,
      user.id,
      exceptionId,
      action,
      JSON.stringify({ previousStatus: 'pending_approval', newStatus })
    )

    // Get updated exception
    const updatedException = db.prepare(`
      SELECT e.*,
        ps.subcontractor_id,
        ps.project_id,
        s.name as subcontractor_name,
        p.name as project_name,
        creator.name as created_by_name,
        approver.name as approved_by_name
      FROM exceptions e
      JOIN project_subcontractors ps ON e.project_subcontractor_id = ps.id
      JOIN subcontractors s ON ps.subcontractor_id = s.id
      JOIN projects p ON ps.project_id = p.id
      JOIN users creator ON e.created_by_user_id = creator.id
      LEFT JOIN users approver ON e.approved_by_user_id = approver.id
      WHERE e.id = ?
    `).get(exceptionId)

    return NextResponse.json({
      success: true,
      message: `Exception ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      exception: updatedException
    })

  } catch (error) {
    console.error('Update exception error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
