import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'
import { downloadFile } from '@/lib/storage'
import path from 'path'

// GET /api/documents/[id]/download - Download a document file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    const { id } = await params

    // Validate document access
    const accessResult = await convex.query(api.documents.validateDocumentAccess, {
      documentId: id as Id<"cocDocuments">,
      userId: user._id,
      userRole: user.role,
      userCompanyId: user.companyId,
    })

    if (!accessResult.canAccess || !accessResult.document) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const document = accessResult.document

    // Determine the storage path from the file URL
    let storagePath: string

    if (document.fileUrl.startsWith('/uploads/')) {
      // Local file URL - extract the path after /uploads/
      storagePath = document.fileUrl.replace('/uploads/', '')
    } else if (document.fileUrl.startsWith('http')) {
      // Supabase URL - extract the storage path
      // Format: https://xxx.supabase.co/storage/v1/object/public/coc-documents/documents/uuid.pdf
      const urlParts = document.fileUrl.split('/coc-documents/')
      storagePath = urlParts[1] || document.fileUrl
    } else {
      storagePath = document.fileUrl
    }

    // Download the file
    const result = await downloadFile(storagePath)

    if (!result.success || !result.buffer) {
      return NextResponse.json({ error: result.error || 'File not found' }, { status: 404 })
    }

    // Determine content type from filename
    const fileName = document.fileName || 'document'
    const ext = path.extname(fileName).toLowerCase()
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
        'Content-Disposition': `attachment; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Content-Length': result.buffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Download document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
