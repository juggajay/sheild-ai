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

    // Get subcontractor details (only count active project assignments)
    const subcontractor = db.prepare(`
      SELECT
        s.*,
        (SELECT COUNT(*) FROM project_subcontractors ps
         JOIN projects p ON ps.project_id = p.id
         WHERE ps.subcontractor_id = s.id AND p.status != 'completed') as project_count
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

    // Get active projects this subcontractor is assigned to (exclude archived)
    const projects = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.status as project_status,
        ps.status as compliance_status,
        ps.on_site_date
      FROM project_subcontractors ps
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.subcontractor_id = ? AND p.status != 'completed'
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

    // Get communications for this subcontractor
    const communications = db.prepare(`
      SELECT
        c.id,
        c.project_id,
        p.name as project_name,
        c.verification_id,
        c.type,
        c.channel,
        c.recipient_email,
        c.cc_emails,
        c.subject,
        c.body,
        c.status,
        c.sent_at,
        c.delivered_at,
        c.opened_at,
        c.created_at
      FROM communications c
      LEFT JOIN projects p ON c.project_id = p.id
      WHERE c.subcontractor_id = ?
      ORDER BY c.created_at DESC
    `).all(id) as Array<{
      id: string
      project_id: string
      project_name: string | null
      verification_id: string | null
      type: string
      channel: string
      recipient_email: string | null
      cc_emails: string | null
      subject: string | null
      body: string | null
      status: string
      sent_at: string | null
      delivered_at: string | null
      opened_at: string | null
      created_at: string
    }>

    // Format communications
    const formattedCommunications = communications.map(comm => ({
      id: comm.id,
      projectId: comm.project_id,
      projectName: comm.project_name,
      verificationId: comm.verification_id,
      type: comm.type,
      channel: comm.channel,
      recipientEmail: comm.recipient_email,
      ccEmails: comm.cc_emails ? comm.cc_emails.split(',') : [],
      subject: comm.subject,
      body: comm.body,
      status: comm.status,
      sentAt: comm.sent_at,
      deliveredAt: comm.delivered_at,
      openedAt: comm.opened_at,
      createdAt: comm.created_at
    }))

    // Get exceptions for this subcontractor
    const exceptions = db.prepare(`
      SELECT
        e.id,
        e.project_subcontractor_id,
        e.verification_id,
        e.issue_summary,
        e.reason,
        e.risk_level,
        e.created_by_user_id,
        e.approved_by_user_id,
        e.approved_at,
        e.expires_at,
        e.expiration_type,
        e.status,
        e.resolved_at,
        e.resolution_type,
        e.resolution_notes,
        e.supporting_document_url,
        e.created_at,
        e.updated_at,
        p.id as project_id,
        p.name as project_name,
        creator.name as created_by_name,
        approver.name as approved_by_name
      FROM exceptions e
      JOIN project_subcontractors ps ON e.project_subcontractor_id = ps.id
      JOIN projects p ON ps.project_id = p.id
      JOIN users creator ON e.created_by_user_id = creator.id
      LEFT JOIN users approver ON e.approved_by_user_id = approver.id
      WHERE ps.subcontractor_id = ?
      ORDER BY e.created_at DESC
    `).all(id) as Array<{
      id: string
      project_subcontractor_id: string
      verification_id: string | null
      issue_summary: string
      reason: string
      risk_level: string
      created_by_user_id: string
      approved_by_user_id: string | null
      approved_at: string | null
      expires_at: string | null
      expiration_type: string
      status: string
      resolved_at: string | null
      resolution_type: string | null
      resolution_notes: string | null
      supporting_document_url: string | null
      created_at: string
      updated_at: string
      project_id: string
      project_name: string
      created_by_name: string
      approved_by_name: string | null
    }>

    // Format exceptions
    const formattedExceptions = exceptions.map(exc => ({
      id: exc.id,
      projectSubcontractorId: exc.project_subcontractor_id,
      verificationId: exc.verification_id,
      issueSummary: exc.issue_summary,
      reason: exc.reason,
      riskLevel: exc.risk_level,
      createdByUserId: exc.created_by_user_id,
      createdByName: exc.created_by_name,
      approvedByUserId: exc.approved_by_user_id,
      approvedByName: exc.approved_by_name,
      approvedAt: exc.approved_at,
      expiresAt: exc.expires_at,
      expirationType: exc.expiration_type,
      status: exc.status,
      resolvedAt: exc.resolved_at,
      resolutionType: exc.resolution_type,
      resolutionNotes: exc.resolution_notes,
      supportingDocumentUrl: exc.supporting_document_url,
      projectId: exc.project_id,
      projectName: exc.project_name,
      createdAt: exc.created_at,
      updatedAt: exc.updated_at
    }))

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
      currentCoc,
      communications: formattedCommunications,
      exceptions: formattedExceptions
    })

  } catch (error) {
    console.error('Get subcontractor error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/subcontractors/[id] - Update a subcontractor
export async function PUT(
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

    // Check if subcontractor exists and belongs to user's company
    const subcontractor = db.prepare(`
      SELECT id FROM subcontractors WHERE id = ? AND company_id = ?
    `).get(id, user.company_id) as { id: string } | undefined

    if (!subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      trading_name,
      address,
      trade,
      contact_name,
      contact_email,
      contact_phone,
      broker_name,
      broker_email,
      broker_phone,
      workers_comp_state
    } = body

    // Build update query dynamically based on provided fields
    const updates: string[] = []
    const values: (string | null)[] = []

    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (trading_name !== undefined) { updates.push('trading_name = ?'); values.push(trading_name) }
    if (address !== undefined) { updates.push('address = ?'); values.push(address) }
    if (trade !== undefined) { updates.push('trade = ?'); values.push(trade) }
    if (contact_name !== undefined) { updates.push('contact_name = ?'); values.push(contact_name) }
    if (contact_email !== undefined) { updates.push('contact_email = ?'); values.push(contact_email) }
    if (contact_phone !== undefined) { updates.push('contact_phone = ?'); values.push(contact_phone) }
    if (broker_name !== undefined) { updates.push('broker_name = ?'); values.push(broker_name) }
    if (broker_email !== undefined) { updates.push('broker_email = ?'); values.push(broker_email) }
    if (broker_phone !== undefined) { updates.push('broker_phone = ?'); values.push(broker_phone) }
    if (workers_comp_state !== undefined) { updates.push('workers_comp_state = ?'); values.push(workers_comp_state) }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push('updated_at = datetime(\'now\')')
    values.push(id)

    db.prepare(`
      UPDATE subcontractors SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)

    // Fetch and return updated subcontractor
    const updated = db.prepare('SELECT * FROM subcontractors WHERE id = ?').get(id) as { name: string } | undefined

    // Log the action
    const { v4: uuidv4 } = await import('uuid')
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'subcontractor', ?, 'update', ?)
    `).run(
      uuidv4(),
      user.company_id,
      user.id,
      id,
      JSON.stringify({
        name: updated?.name,
        updatedFields: Object.keys(body).filter(k => body[k] !== undefined)
      })
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update subcontractor error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/subcontractors/[id] - Delete a subcontractor
export async function DELETE(
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

    // Only admin and risk_manager can delete subcontractors
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins and risk managers can delete subcontractors' }, { status: 403 })
    }

    const { id } = await params
    const db = getDb()

    // Check if subcontractor exists and belongs to user's company
    const subcontractor = db.prepare(`
      SELECT id, name, company_id
      FROM subcontractors
      WHERE id = ? AND company_id = ?
    `).get(id, user.company_id) as { id: string; name: string; company_id: string } | undefined

    if (!subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Check if subcontractor is assigned to any projects
    const projectAssignments = db.prepare(`
      SELECT COUNT(*) as count
      FROM project_subcontractors
      WHERE subcontractor_id = ?
    `).get(id) as { count: number }

    if (projectAssignments.count > 0) {
      return NextResponse.json({
        error: 'Cannot delete subcontractor that is assigned to projects. Remove from all projects first.',
        assignedProjects: projectAssignments.count
      }, { status: 400 })
    }

    // Delete related records first (cascade)
    // Delete COC documents
    db.prepare('DELETE FROM coc_documents WHERE subcontractor_id = ?').run(id)

    // Delete communications
    db.prepare('DELETE FROM communications WHERE subcontractor_id = ?').run(id)

    // Delete the subcontractor
    db.prepare('DELETE FROM subcontractors WHERE id = ?').run(id)

    // Log the action
    const { v4: uuidv4 } = await import('uuid')
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'subcontractor', ?, 'delete', ?)
    `).run(
      uuidv4(),
      user.company_id,
      user.id,
      id,
      JSON.stringify({ name: subcontractor.name })
    )

    return NextResponse.json({
      success: true,
      message: 'Subcontractor deleted successfully'
    })

  } catch (error) {
    console.error('Delete subcontractor error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
