import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

// GET /api/subcontractors/[id] - Get a single subcontractor with COC history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params
    const db = getDb()

    // Get subcontractor details
    const subcontractor = db.prepare(`
      SELECT
        s.*,
        (SELECT COUNT(*) FROM project_subcontractors ps WHERE ps.subcontractor_id = s.id) as project_count
      FROM subcontractors s
      WHERE s.id = ? AND s.company_id = ?
    `).get(id, user.company_id) as {
      id: string
      name: string
      abn: string
      acn: string | null
      trading_name: string | null
      address: string | null
      trade: string | null
      contact_name: string | null
      contact_email: string | null
      contact_phone: string | null
      broker_name: string | null
      broker_email: string | null
      broker_phone: string | null
      workers_comp_state: string | null
      portal_access: number
      portal_user_id: string | null
      created_at: string
      updated_at: string
      project_count: number
    } | undefined

    if (!subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Get projects this subcontractor is assigned to
    const projects = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.status as project_status,
        ps.status as compliance_status,
        ps.on_site_date
      FROM project_subcontractors ps
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.subcontractor_id = ?
      ORDER BY p.name ASC
    `).all(id) as Array<{
      id: string
      name: string
      project_status: string
      compliance_status: string
      on_site_date: string | null
    }>

    // Get COC documents with verification status
    const cocDocuments = db.prepare(`
      SELECT
        coc.id,
        coc.project_id,
        p.name as project_name,
        coc.file_url,
        coc.file_name,
        coc.file_size,
        coc.source,
        coc.source_email,
        coc.received_at,
        coc.processed_at,
        coc.processing_status,
        coc.created_at,
        v.id as verification_id,
        v.status as verification_status,
        v.confidence_score,
        v.extracted_data,
        v.checks,
        v.deficiencies,
        v.verified_at
      FROM coc_documents coc
      LEFT JOIN projects p ON coc.project_id = p.id
      LEFT JOIN verifications v ON v.coc_document_id = coc.id
      WHERE coc.subcontractor_id = ?
      ORDER BY coc.created_at DESC
    `).all(id) as Array<{
      id: string
      project_id: string
      project_name: string | null
      file_url: string
      file_name: string | null
      file_size: number | null
      source: string
      source_email: string | null
      received_at: string | null
      processed_at: string | null
      processing_status: string
      created_at: string
      verification_id: string | null
      verification_status: string | null
      confidence_score: number | null
      extracted_data: string | null
      checks: string | null
      deficiencies: string | null
      verified_at: string | null
    }>

    // Parse JSON fields and format COC documents
    const formattedCocs = cocDocuments.map(coc => ({
      id: coc.id,
      projectId: coc.project_id,
      projectName: coc.project_name,
      fileUrl: coc.file_url,
      fileName: coc.file_name,
      fileSize: coc.file_size,
      source: coc.source,
      sourceEmail: coc.source_email,
      receivedAt: coc.received_at,
      processedAt: coc.processed_at,
      processingStatus: coc.processing_status,
      createdAt: coc.created_at,
      verification: coc.verification_id ? {
        id: coc.verification_id,
        status: coc.verification_status,
        confidenceScore: coc.confidence_score,
        extractedData: coc.extracted_data ? JSON.parse(coc.extracted_data) : {},
        checks: coc.checks ? JSON.parse(coc.checks) : [],
        deficiencies: coc.deficiencies ? JSON.parse(coc.deficiencies) : [],
        verifiedAt: coc.verified_at
      } : null
    }))

    // Get the most recent COC with a verification
    const currentCoc = formattedCocs.find(coc => coc.verification)

    return NextResponse.json({
      subcontractor: {
        id: subcontractor.id,
        name: subcontractor.name,
        abn: subcontractor.abn,
        acn: subcontractor.acn,
        tradingName: subcontractor.trading_name,
        address: subcontractor.address,
        trade: subcontractor.trade,
        contactName: subcontractor.contact_name,
        contactEmail: subcontractor.contact_email,
        contactPhone: subcontractor.contact_phone,
        brokerName: subcontractor.broker_name,
        brokerEmail: subcontractor.broker_email,
        brokerPhone: subcontractor.broker_phone,
        workersCompState: subcontractor.workers_comp_state,
        portalAccess: subcontractor.portal_access === 1,
        projectCount: subcontractor.project_count,
        createdAt: subcontractor.created_at,
        updatedAt: subcontractor.updated_at
      },
      projects,
      cocDocuments: formattedCocs,
      currentCoc
    })

  } catch (error) {
    console.error('Get subcontractor error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
