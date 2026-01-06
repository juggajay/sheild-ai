import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

// GET /api/portal/builders - Get all builder relationships for portal user
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

    // Find all subcontractor records that match the portal user's email
    // A subcontractor might work with multiple builders (companies)
    const subcontractorRecords = db.prepare(`
      SELECT
        s.id as subcontractor_id,
        s.name as subcontractor_name,
        s.company_id,
        c.name as company_name
      FROM subcontractors s
      JOIN companies c ON s.company_id = c.id
      WHERE s.contact_email = ?
    `).all(user.email) as Array<{
      subcontractor_id: string
      subcontractor_name: string
      company_id: string
      company_name: string
    }>

    if (subcontractorRecords.length === 0) {
      return NextResponse.json({
        builders: [],
        summary: {
          totalBuilders: 0,
          compliant: 0,
          actionRequired: 0,
          expiringSoon: 0
        }
      })
    }

    // For each builder relationship, get projects and compliance status
    const builders = subcontractorRecords.map(record => {
      // Get projects for this subcontractor with their compliance status
      const projects = db.prepare(`
        SELECT
          p.id,
          p.name,
          p.status as project_status,
          ps.status as compliance_status,
          ps.on_site_date,
          (
            SELECT COUNT(*)
            FROM verifications v
            JOIN coc_documents coc ON v.coc_document_id = coc.id
            WHERE coc.subcontractor_id = ps.subcontractor_id
              AND coc.project_id = ps.project_id
              AND v.status = 'deficient'
          ) as deficiency_count
        FROM project_subcontractors ps
        JOIN projects p ON ps.project_id = p.id
        WHERE ps.subcontractor_id = ?
        ORDER BY p.name ASC
      `).all(record.subcontractor_id) as Array<{
        id: string
        name: string
        project_status: string
        compliance_status: string
        on_site_date: string | null
        deficiency_count: number
      }>

      // Calculate compliance summary for this builder
      const compliantProjects = projects.filter(p => p.compliance_status === 'compliant').length
      const nonCompliantProjects = projects.filter(p => p.compliance_status === 'non_compliant').length
      const pendingProjects = projects.filter(p => p.compliance_status === 'pending').length
      const totalDeficiencies = projects.reduce((sum, p) => sum + p.deficiency_count, 0)

      // Check for expiring certificates (within 30 days)
      const expiringSoon = db.prepare(`
        SELECT COUNT(*) as count
        FROM verifications v
        JOIN coc_documents coc ON v.coc_document_id = coc.id
        WHERE coc.subcontractor_id = ?
          AND v.status = 'verified'
          AND json_extract(v.extracted_data, '$.expiryDate') IS NOT NULL
          AND date(json_extract(v.extracted_data, '$.expiryDate')) <= date('now', '+30 days')
          AND date(json_extract(v.extracted_data, '$.expiryDate')) >= date('now')
      `).get(record.subcontractor_id) as { count: number }

      // Get outstanding communication requests (deficiency notices not yet addressed)
      const outstandingRequests = db.prepare(`
        SELECT
          c.id,
          c.type,
          c.subject,
          c.sent_at,
          p.name as project_name
        FROM communications c
        LEFT JOIN projects p ON c.project_id = p.id
        WHERE c.subcontractor_id = ?
          AND c.type = 'deficiency'
          AND c.status = 'sent'
          AND NOT EXISTS (
            SELECT 1 FROM coc_documents coc
            WHERE coc.subcontractor_id = c.subcontractor_id
              AND coc.project_id = c.project_id
              AND coc.created_at > c.sent_at
          )
        ORDER BY c.sent_at DESC
        LIMIT 5
      `).all(record.subcontractor_id) as Array<{
        id: string
        type: string
        subject: string | null
        sent_at: string | null
        project_name: string | null
      }>

      return {
        id: record.company_id,
        name: record.company_name,
        subcontractorId: record.subcontractor_id,
        projects: projects.map(p => ({
          id: p.id,
          name: p.name,
          status: p.project_status,
          complianceStatus: p.compliance_status,
          onSiteDate: p.on_site_date,
          deficiencyCount: p.deficiency_count
        })),
        summary: {
          totalProjects: projects.length,
          compliant: compliantProjects,
          nonCompliant: nonCompliantProjects,
          pending: pendingProjects,
          deficiencies: totalDeficiencies,
          expiringSoon: expiringSoon.count
        },
        outstandingRequests: outstandingRequests.map(r => ({
          id: r.id,
          type: r.type,
          subject: r.subject,
          sentAt: r.sent_at,
          projectName: r.project_name
        })),
        overallStatus: nonCompliantProjects > 0 ? 'action_required' :
                       pendingProjects > 0 ? 'pending' :
                       compliantProjects > 0 ? 'compliant' : 'no_projects'
      }
    })

    // Calculate overall summary
    const summary = {
      totalBuilders: builders.length,
      compliant: builders.filter(b => b.overallStatus === 'compliant').length,
      actionRequired: builders.filter(b => b.overallStatus === 'action_required').length,
      expiringSoon: builders.reduce((sum, b) => sum + b.summary.expiringSoon, 0)
    }

    return NextResponse.json({
      builders,
      summary
    })

  } catch (error) {
    console.error('Get portal builders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
