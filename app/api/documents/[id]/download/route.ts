import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'
import { downloadFile } from '@/lib/storage'
import path from 'path'

interface COCDocument {
  id: string
  file_url: string
  file_name: string
  project_id: string
}

interface Project {
  id: string
  company_id: string
  project_manager_id: string | null
}

// GET /api/documents/[id]/download - Download a document file
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

    // Get document
    const document = db.prepare(`
      SELECT d.*, p.company_id, p.project_manager_id
      FROM coc_documents d
      JOIN projects p ON d.project_id = p.id
      WHERE d.id = ?
    `).get(params.id) as (COCDocument & { company_id: string; project_manager_id: string | null }) | undefined

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check access - must be same company
    if (document.company_id !== user.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // For project_manager role, check if they manage this project
    if (user.role === 'project_manager' && document.project_manager_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Determine the storage path from the file URL
    let storagePath: string

    if (document.file_url.startsWith('/uploads/')) {
      // Local file URL - extract the path after /uploads/
      storagePath = document.file_url.replace('/uploads/', '')
    } else if (document.file_url.startsWith('http')) {
      // Supabase URL - extract the storage path
      // Format: https://xxx.supabase.co/storage/v1/object/public/coc-documents/documents/uuid.pdf
      const urlParts = document.file_url.split('/coc-documents/')
      storagePath = urlParts[1] || document.file_url
    } else {
      storagePath = document.file_url
    }

    // Download the file
    const result = await downloadFile(storagePath)

    if (!result.success || !result.buffer) {
      return NextResponse.json({ error: result.error || 'File not found' }, { status: 404 })
    }

    // Determine content type from filename
    const ext = path.extname(document.file_name).toLowerCase()
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif'
    }
    const contentType = result.contentType || contentTypes[ext] || 'application/octet-stream'

    // Return the file - convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${(document.file_name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Content-Length': result.buffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Download document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
