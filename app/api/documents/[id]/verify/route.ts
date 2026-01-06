import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

// POST /api/documents/[id]/verify - Manual verification action (approve/reject)
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

    // Only certain roles can manually verify documents
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to verify documents' }, { status: 403 })
    }

    const body = await request.json()
    const { action, notes } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
    }

    const db = getDb()

    // Get the document and verification
    const document = db.prepare(`
      SELECT
        d.*,
        p.company_id,
        p.id as project_id,
        v.id as verification_id,
        v.status as verification_status
      FROM coc_documents d
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN verifications v ON v.coc_document_id = d.id
      WHERE d.id = ?
    `).get(params.id) as any

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify user has access to this document's company
    if (document.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (!document.verification_id) {
      return NextResponse.json({ error: 'Document has not been verified yet' }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'pass' : 'fail'

    // Update the verification status
    db.prepare(`
      UPDATE verifications
      SET status = ?,
          verified_by_user_id = ?,
          verified_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, user.id, document.verification_id)

    // Update project_subcontractors status based on verification result
    if (action === 'approve') {
      db.prepare(`
        UPDATE project_subcontractors
        SET status = 'compliant', updated_at = datetime('now')
        WHERE project_id = ? AND subcontractor_id = ?
      `).run(document.project_id, document.subcontractor_id)
    } else {
      db.prepare(`
        UPDATE project_subcontractors
        SET status = 'non_compliant', updated_at = datetime('now')
        WHERE project_id = ? AND subcontractor_id = ?
      `).run(document.project_id, document.subcontractor_id)
    }

    // Log the manual verification action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'verification', ?, ?, ?)
    `).run(
      uuidv4(),
      user.company_id,
      user.id,
      document.verification_id,
      `manual_${action}`,
      JSON.stringify({
        documentId: params.id,
        previousStatus: document.verification_status,
        newStatus,
        notes: notes || null,
        subcontractorId: document.subcontractor_id,
        projectId: document.project_id
      })
    )

    return NextResponse.json({
      success: true,
      message: `Document ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      newStatus
    })
  } catch (error) {
    console.error('Manual verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
