import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, type Project } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

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

// GET /api/documents - List documents
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

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const subcontractorId = searchParams.get('subcontractorId')

    const db = getDb()

    let query = `
      SELECT
        d.*,
        s.name as subcontractor_name,
        s.abn as subcontractor_abn,
        p.name as project_name,
        v.status as verification_status,
        v.confidence_score
      FROM coc_documents d
      JOIN subcontractors s ON d.subcontractor_id = s.id
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN verifications v ON v.coc_document_id = d.id
      WHERE p.company_id = ?
    `
    const params: (string | null)[] = [user.company_id]

    if (projectId) {
      query += ' AND d.project_id = ?'
      params.push(projectId)
    }

    if (subcontractorId) {
      query += ' AND d.subcontractor_id = ?'
      params.push(subcontractorId)
    }

    query += ' ORDER BY d.created_at DESC'

    const documents = db.prepare(query).all(...params)

    return NextResponse.json({
      documents,
      total: documents.length
    })
  } catch (error) {
    console.error('Get documents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/documents - Upload a new document
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

    // Only certain roles can upload documents
    if (!['admin', 'risk_manager', 'project_manager', 'project_administrator'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to upload documents' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string | null
    const subcontractorId = formData.get('subcontractorId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!projectId || !subcontractorId) {
      return NextResponse.json({ error: 'Project ID and Subcontractor ID are required' }, { status: 400 })
    }

    // Validate file type (PDF or image)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Invalid file type. Only PDF and image files are allowed'
      }, { status: 400 })
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({
        error: 'File too large. Maximum size is 10MB'
      }, { status: 400 })
    }

    const db = getDb()

    // Verify project exists and user has access
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project | undefined
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!canAccessProject(user, project)) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    // Verify subcontractor exists and belongs to same company
    const subcontractor = db.prepare('SELECT * FROM subcontractors WHERE id = ? AND company_id = ?')
      .get(subcontractorId, user.company_id)
    if (!subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Verify subcontractor is assigned to the project
    const assignment = db.prepare('SELECT id FROM project_subcontractors WHERE project_id = ? AND subcontractor_id = ?')
      .get(projectId, subcontractorId)
    if (!assignment) {
      return NextResponse.json({ error: 'Subcontractor is not assigned to this project' }, { status: 400 })
    }

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name)
    const uniqueFilename = `${uuidv4()}${fileExtension}`
    const filePath = path.join(uploadDir, uniqueFilename)
    const fileUrl = `/uploads/documents/${uniqueFilename}`

    // Save file to disk
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(filePath, buffer)

    // Create document record
    const documentId = uuidv4()
    db.prepare(`
      INSERT INTO coc_documents (id, subcontractor_id, project_id, file_url, file_name, file_size, source, received_at, processing_status)
      VALUES (?, ?, ?, ?, ?, ?, 'upload', datetime('now'), 'pending')
    `).run(documentId, subcontractorId, projectId, fileUrl, file.name, file.size)

    // Create initial verification record
    const verificationId = uuidv4()
    db.prepare(`
      INSERT INTO verifications (id, coc_document_id, project_id, status, extracted_data, checks, deficiencies)
      VALUES (?, ?, ?, 'review', '{}', '[]', '[]')
    `).run(verificationId, documentId, projectId)

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'coc_document', ?, 'upload', ?)
    `).run(uuidv4(), user.company_id, user.id, documentId, JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      projectId,
      subcontractorId
    }))

    // Update document processing status to 'processing'
    db.prepare(`
      UPDATE coc_documents SET processing_status = 'processing', processed_at = datetime('now')
      WHERE id = ?
    `).run(documentId)

    // In a real app, we would trigger AI processing here
    // For now, mark as completed after a simulated delay
    setTimeout(() => {
      try {
        const db = getDb()
        db.prepare(`
          UPDATE coc_documents SET processing_status = 'completed', updated_at = datetime('now')
          WHERE id = ?
        `).run(documentId)
      } catch (e) {
        console.error('Failed to update processing status:', e)
      }
    }, 2000)

    return NextResponse.json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        id: documentId,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        processingStatus: 'processing'
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Upload document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
