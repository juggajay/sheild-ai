import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

// GET /api/portal/broker/clients - Get all clients for a broker
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

    // Find all subcontractors where broker_email matches the user's email
    const clients = db.prepare(`
      SELECT
        s.id,
        s.name,
        s.abn,
        s.trading_name,
        s.trade,
        s.contact_name,
        s.contact_email,
        s.contact_phone,
        s.company_id,
        c.name as builder_name
      FROM subcontractors s
      JOIN companies c ON s.company_id = c.id
      WHERE s.broker_email = ?
      ORDER BY s.name ASC
    `).all(user.email) as Array<{
      id: string
      name: string
      abn: string
      trading_name: string | null
      trade: string | null
      contact_name: string | null
      contact_email: string | null
      contact_phone: string | null
      company_id: string
      builder_name: string
    }>

    // For each client, get their compliance status across all projects
    const clientsWithStatus = clients.map(client => {
      const projects = db.prepare(`
        SELECT
          ps.id as project_subcontractor_id,
          ps.status as compliance_status,
          p.id as project_id,
          p.name as project_name,
          p.status as project_status
        FROM project_subcontractors ps
        JOIN projects p ON ps.project_id = p.id
        WHERE ps.subcontractor_id = ?
        ORDER BY p.name ASC
      `).all(client.id) as Array<{
        project_subcontractor_id: string
        compliance_status: string
        project_id: string
        project_name: string
        project_status: string
      }>

      // Count statuses
      const compliantCount = projects.filter(p => p.compliance_status === 'compliant').length
      const nonCompliantCount = projects.filter(p => p.compliance_status === 'non_compliant').length
      const pendingCount = projects.filter(p => p.compliance_status === 'pending').length
      const exceptionCount = projects.filter(p => p.compliance_status === 'exception').length

      // Get latest COC
      const latestCoc = db.prepare(`
        SELECT
          coc.id,
          coc.file_name,
          coc.created_at,
          v.status as verification_status
        FROM coc_documents coc
        LEFT JOIN verifications v ON v.coc_document_id = coc.id
        WHERE coc.subcontractor_id = ?
        ORDER BY coc.created_at DESC
        LIMIT 1
      `).get(client.id) as {
        id: string
        file_name: string | null
        created_at: string
        verification_status: string | null
      } | undefined

      // Calculate overall status
      let overallStatus: string
      if (nonCompliantCount > 0) {
        overallStatus = 'non_compliant'
      } else if (exceptionCount > 0) {
        overallStatus = 'exception'
      } else if (pendingCount > 0) {
        overallStatus = 'pending'
      } else if (compliantCount > 0) {
        overallStatus = 'compliant'
      } else {
        overallStatus = 'no_projects'
      }

      return {
        id: client.id,
        name: client.name,
        abn: client.abn,
        tradingName: client.trading_name,
        trade: client.trade,
        contactName: client.contact_name,
        contactEmail: client.contact_email,
        contactPhone: client.contact_phone,
        builderId: client.company_id,
        builderName: client.builder_name,
        projects: projects.map(p => ({
          id: p.project_id,
          name: p.project_name,
          status: p.project_status,
          complianceStatus: p.compliance_status
        })),
        summary: {
          totalProjects: projects.length,
          compliant: compliantCount,
          nonCompliant: nonCompliantCount,
          pending: pendingCount,
          exception: exceptionCount
        },
        latestCoc: latestCoc ? {
          id: latestCoc.id,
          fileName: latestCoc.file_name,
          createdAt: latestCoc.created_at,
          status: latestCoc.verification_status
        } : null,
        overallStatus
      }
    })

    // Calculate summary across all clients
    const summary = {
      totalClients: clientsWithStatus.length,
      compliant: clientsWithStatus.filter(c => c.overallStatus === 'compliant').length,
      nonCompliant: clientsWithStatus.filter(c => c.overallStatus === 'non_compliant').length,
      pending: clientsWithStatus.filter(c => c.overallStatus === 'pending').length,
      actionRequired: clientsWithStatus.filter(c => ['non_compliant', 'exception'].includes(c.overallStatus)).length
    }

    return NextResponse.json({
      clients: clientsWithStatus,
      summary
    })

  } catch (error) {
    console.error('Get broker clients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
