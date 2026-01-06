import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

interface CocDocument {
  id: string
  subcontractor_id: string
  project_id: string
  file_url: string
  file_name: string | null
  file_size: number | null
  source: string
  processing_status: string
  created_at: string
}

// GET /api/documents/[id] - Get document details
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

    const document = db.prepare(`
      SELECT
        d.*,
        s.name as subcontractor_name,
        s.abn as subcontractor_abn,
        p.name as project_name,
        p.company_id,
        v.id as verification_id,
        v.status as verification_status,
        v.confidence_score,
        v.extracted_data,
        v.checks,
        v.deficiencies
      FROM coc_documents d
      JOIN subcontractors s ON d.subcontractor_id = s.id
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN verifications v ON v.coc_document_id = d.id
      WHERE d.id = ?
    `).get(params.id) as (CocDocument & { company_id: string }) | undefined

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify user has access to this document's company
    if (document.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/documents/[id] - Delete a document
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

    // Only certain roles can delete documents
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to delete documents' }, { status: 403 })
    }

    const db = getDb()

    const document = db.prepare(`
      SELECT d.*, p.company_id
      FROM coc_documents d
      JOIN projects p ON d.project_id = p.id
      WHERE d.id = ?
    `).get(params.id) as (CocDocument & { company_id: string }) | undefined

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify user has access to this document's company
    if (document.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete verification records first (foreign key constraint)
    db.prepare('DELETE FROM verifications WHERE coc_document_id = ?').run(params.id)

    // Delete the document record
    db.prepare('DELETE FROM coc_documents WHERE id = ?').run(params.id)

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'coc_document', ?, 'delete', ?)
    `).run(uuidv4(), user.company_id, user.id, params.id, JSON.stringify({
      fileName: document.file_name
    }))

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
