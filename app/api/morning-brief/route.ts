import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

// GET /api/morning-brief - Get dashboard morning brief data
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
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

    // Get stop work risks - subcontractors on-site today (or past) with non-compliant status
    const stopWorkRisks = db.prepare(`
      SELECT
        ps.id,
        ps.status,
        ps.on_site_date,
        p.id as project_id,
        p.name as project_name,
        s.id as subcontractor_id,
        s.name as subcontractor_name,
        s.abn as subcontractor_abn,
        (SELECT COUNT(*) FROM exceptions e WHERE e.project_subcontractor_id = ps.id AND e.status = 'active') as active_exceptions
      FROM project_subcontractors ps
      JOIN projects p ON ps.project_id = p.id
      JOIN subcontractors s ON ps.subcontractor_id = s.id
      WHERE p.company_id = ?
        AND ps.on_site_date IS NOT NULL
        AND ps.on_site_date <= ?
        AND ps.status IN ('non_compliant', 'pending')
      ORDER BY ps.on_site_date ASC
    `).all(user.company_id, today) as Array<{
      id: string
      status: string
      on_site_date: string
      project_id: string
      project_name: string
      subcontractor_id: string
      subcontractor_name: string
      subcontractor_abn: string
      active_exceptions: number
    }>

    // Get compliance statistics
    const complianceStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ps.status = 'compliant' THEN 1 ELSE 0 END) as compliant,
        SUM(CASE WHEN ps.status = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant,
        SUM(CASE WHEN ps.status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN ps.status = 'exception' THEN 1 ELSE 0 END) as exception
      FROM project_subcontractors ps
      JOIN projects p ON ps.project_id = p.id
      WHERE p.company_id = ?
    `).get(user.company_id) as {
      total: number
      compliant: number
      non_compliant: number
      pending: number
      exception: number
    }

    // Calculate compliance rate
    const complianceRate = complianceStats.total > 0
      ? Math.round(((complianceStats.compliant + complianceStats.exception) / complianceStats.total) * 100)
      : null

    // Get active projects count (projects with at least one subcontractor)
    const activeProjectsResult = db.prepare(`
      SELECT COUNT(DISTINCT p.id) as count
      FROM projects p
      JOIN project_subcontractors ps ON p.id = ps.project_id
      WHERE p.company_id = ?
    `).get(user.company_id) as { count: number }

    // Get pending reviews count (documents awaiting review)
    const pendingReviewsResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM coc_documents d
      JOIN subcontractors s ON d.subcontractor_id = s.id
      JOIN projects p ON d.project_id = p.id
      WHERE p.company_id = ?
        AND d.processing_status = 'pending'
    `).get(user.company_id) as { count: number }

    // Get new COCs received in last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const newCocs = db.prepare(`
      SELECT
        d.id,
        d.file_name,
        d.received_at,
        d.processing_status,
        s.name as subcontractor_name,
        p.name as project_name,
        v.status as verification_status
      FROM coc_documents d
      JOIN subcontractors s ON d.subcontractor_id = s.id
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN verifications v ON d.id = v.coc_document_id
      WHERE p.company_id = ?
        AND d.received_at >= ?
      ORDER BY d.received_at DESC
      LIMIT 10
    `).all(user.company_id, yesterday) as Array<{
      id: string
      file_name: string
      received_at: string
      processing_status: string
      subcontractor_name: string
      project_name: string
      verification_status: string | null
    }>

    // Calculate COC statistics for overnight arrivals
    const cocStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN v.status = 'pass' THEN 1 ELSE 0 END) as auto_approved,
        SUM(CASE WHEN v.status = 'fail' OR v.status IS NULL OR d.processing_status = 'pending' THEN 1 ELSE 0 END) as needs_review
      FROM coc_documents d
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN verifications v ON d.id = v.coc_document_id
      WHERE p.company_id = ?
        AND d.received_at >= ?
    `).get(user.company_id, yesterday) as {
      total: number
      auto_approved: number
      needs_review: number
    }

    // Get pending responses - failed verifications where we sent a communication but haven't received a new COC
    // This finds the most recent failed verification for each subcontractor/project combo
    // and checks if there's been a follow-up COC since the last communication
    const pendingResponses = db.prepare(`
      SELECT
        v.id as verification_id,
        v.status as verification_status,
        v.created_at as verification_date,
        d.id as document_id,
        d.file_name,
        s.id as subcontractor_id,
        s.name as subcontractor_name,
        s.contact_email as broker_email,
        p.id as project_id,
        p.name as project_name,
        c.id as communication_id,
        c.sent_at as last_communication_date,
        c.type as communication_type,
        CAST(julianday('now') - julianday(c.sent_at) AS INTEGER) as days_waiting
      FROM verifications v
      JOIN coc_documents d ON v.coc_document_id = d.id
      JOIN subcontractors s ON d.subcontractor_id = s.id
      JOIN projects p ON d.project_id = p.id
      JOIN communications c ON c.verification_id = v.id
      WHERE p.company_id = ?
        AND v.status = 'fail'
        AND c.status IN ('sent', 'delivered', 'opened')
        AND NOT EXISTS (
          -- No newer COC uploaded after the communication for this subcontractor/project
          SELECT 1 FROM coc_documents d2
          WHERE d2.subcontractor_id = s.id
            AND d2.project_id = p.id
            AND d2.received_at > c.sent_at
        )
      ORDER BY days_waiting DESC
      LIMIT 10
    `).all(user.company_id) as Array<{
      verification_id: string
      verification_status: string
      verification_date: string
      document_id: string
      file_name: string
      subcontractor_id: string
      subcontractor_name: string
      broker_email: string | null
      project_id: string
      project_name: string
      communication_id: string
      last_communication_date: string
      communication_type: string
      days_waiting: number
    }>

    return NextResponse.json({
      stopWorkRisks,
      stats: {
        complianceRate,
        activeProjects: activeProjectsResult.count,
        pendingReviews: pendingReviewsResult.count,
        stopWorkCount: stopWorkRisks.length,
        pendingResponsesCount: pendingResponses.length,
        ...complianceStats
      },
      newCocs,
      cocStats: {
        total: cocStats.total || 0,
        autoApproved: cocStats.auto_approved || 0,
        needsReview: cocStats.needs_review || 0
      },
      pendingResponses
    })

  } catch (error) {
    console.error('Morning brief error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
