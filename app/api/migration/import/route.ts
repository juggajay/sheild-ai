import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'
import { createNotificationForProjectTeam } from '@/lib/notifications'
import type { ExtractedVendor } from '@/lib/document-classifier'
import { migrationSessions } from '@/lib/migration-sessions'

// POST /api/migration/import - Execute the import from a reviewed session
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

    // Only admin and risk_manager can perform data migration
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only administrators and risk managers can perform data migration' }, { status: 403 })
    }

    const body = await request.json()
    const {
      sessionId,
      vendorsToCreate,
      vendorMappings,
      importCOCs
    } = body as {
      sessionId: string
      vendorsToCreate?: ExtractedVendor[]
      vendorMappings?: Record<string, string> // extractedABN -> subcontractorId
      importCOCs?: boolean
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Get the session
    const session = migrationSessions.get(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Migration session not found' }, { status: 404 })
    }

    if (session.companyId !== user.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (session.status !== 'reviewing') {
      return NextResponse.json({ error: 'Session is not in review status' }, { status: 400 })
    }

    // Update session status to importing
    session.status = 'importing'
    session.updatedAt = new Date().toISOString()
    migrationSessions.set(sessionId, session)

    const db = getDb()
    const results = {
      subcontractorsCreated: 0,
      subcontractorsAssigned: 0,
      documentsImported: 0,
      errors: [] as string[]
    }

    try {
      // Start transaction
      db.exec('BEGIN TRANSACTION')

      // 1. Create new subcontractors
      const vendorsToImport = vendorsToCreate || session.vendorsToCreate
      const newSubcontractorMap = new Map<string, string>() // ABN/name -> new ID

      for (const vendor of vendorsToImport) {
        const subId = uuidv4()
        try {
          db.prepare(`
            INSERT INTO subcontractors (id, company_id, name, abn, contact_email, contact_phone, address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            subId,
            user.company_id,
            vendor.name,
            vendor.abn || '',
            vendor.email || '',
            vendor.phone || '',
            vendor.address || ''
          )

          // Map both ABN and name for later lookup
          if (vendor.abn) newSubcontractorMap.set(vendor.abn, subId)
          newSubcontractorMap.set(vendor.name.toLowerCase(), subId)

          results.subcontractorsCreated++
          console.log(`[MIGRATION] Created subcontractor: ${vendor.name} (${subId})`)
        } catch (error) {
          const msg = `Failed to create subcontractor ${vendor.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          results.errors.push(msg)
          console.error(`[MIGRATION] ${msg}`)
        }
      }

      // 2. Build complete vendor mapping (existing matches + new creations)
      const completeMapping = new Map<string, string>()

      // Add existing matches from session
      for (const match of session.vendorsToMatch) {
        if (match.matchedSubcontractorId) {
          if (match.extractedVendor.abn) {
            completeMapping.set(match.extractedVendor.abn, match.matchedSubcontractorId)
          }
          completeMapping.set(match.extractedVendor.name.toLowerCase(), match.matchedSubcontractorId)
        }
      }

      // Add user-provided mappings (overrides)
      if (vendorMappings) {
        for (const [key, subId] of Object.entries(vendorMappings)) {
          completeMapping.set(key, subId)
        }
      }

      // Add newly created subcontractors
      newSubcontractorMap.forEach((subId, key) => {
        completeMapping.set(key, subId)
      })

      // 3. Assign subcontractors to project if not already assigned
      const assignedSubIds = new Set<string>()

      completeMapping.forEach((subId) => {
        if (assignedSubIds.has(subId)) return
        assignedSubIds.add(subId)

        // Check if already assigned
        const existing = db.prepare(
          'SELECT id FROM project_subcontractors WHERE project_id = ? AND subcontractor_id = ?'
        ).get(session.projectId, subId)

        if (!existing) {
          try {
            db.prepare(`
              INSERT INTO project_subcontractors (id, project_id, subcontractor_id, status)
              VALUES (?, ?, ?, 'pending')
            `).run(uuidv4(), session.projectId, subId)
            results.subcontractorsAssigned++
            console.log(`[MIGRATION] Assigned subcontractor ${subId} to project ${session.projectId}`)
          } catch (error) {
            const msg = `Failed to assign subcontractor ${subId}: ${error instanceof Error ? error.message : 'Unknown error'}`
            results.errors.push(msg)
            console.error(`[MIGRATION] ${msg}`)
          }
        }
      })

      // 4. Import COC documents if requested
      if (importCOCs !== false) {
        for (const coc of session.cocDocuments) {
          // Find the subcontractor ID for this COC
          let subId = coc.vendorMatch // Pre-matched ID

          if (!subId && coc.data.vendorAbn) {
            subId = completeMapping.get(coc.data.vendorAbn)
          }
          if (!subId && coc.data.vendorName) {
            subId = completeMapping.get(coc.data.vendorName.toLowerCase())
          }

          if (!subId) {
            results.errors.push(`No subcontractor match found for COC: ${coc.data.vendorName}`)
            continue
          }

          // Get the document info
          const docInfo = session.documents.find(d => d.id === coc.documentId)

          try {
            // Create COC document record
            const docId = uuidv4()
            db.prepare(`
              INSERT INTO coc_documents (id, subcontractor_id, project_id, file_url, file_name, file_size, source, received_at, processing_status)
              VALUES (?, ?, ?, ?, ?, ?, 'migration', datetime('now'), 'completed')
            `).run(
              docId,
              subId,
              session.projectId,
              `/uploads/migration/${docInfo?.fileName || 'document.pdf'}`,
              docInfo?.fileName || 'Migrated COC',
              docInfo?.fileSize || 0
            )

            // Create verification record with extracted data
            const verificationId = uuidv4()
            const status = 'pass' // Assume migrated documents are verified

            db.prepare(`
              INSERT INTO verifications (id, coc_document_id, project_id, status, confidence_score, extracted_data, checks, deficiencies)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              verificationId,
              docId,
              session.projectId,
              status,
              0.85, // Simulated confidence for migration
              JSON.stringify({
                insured_party_name: coc.data.vendorName,
                insured_party_abn: coc.data.vendorAbn,
                insurer_name: coc.data.insurerName,
                policy_number: coc.data.policyNumber,
                period_of_insurance_start: coc.data.policyStartDate,
                period_of_insurance_end: coc.data.policyEndDate,
                coverages: coc.data.coverages,
                extraction_confidence: 0.85,
                extraction_model: 'migration-import'
              }),
              JSON.stringify([
                { check_type: 'migration_import', description: 'Data Migration', status: 'pass', details: 'Imported from bulk migration' }
              ]),
              JSON.stringify([])
            )

            // Update subcontractor compliance status
            db.prepare(`
              UPDATE project_subcontractors
              SET status = 'compliant', updated_at = datetime('now')
              WHERE project_id = ? AND subcontractor_id = ?
            `).run(session.projectId, subId)

            results.documentsImported++
            console.log(`[MIGRATION] Imported COC for ${coc.data.vendorName}`)
          } catch (error) {
            const msg = `Failed to import COC for ${coc.data.vendorName}: ${error instanceof Error ? error.message : 'Unknown error'}`
            results.errors.push(msg)
            console.error(`[MIGRATION] ${msg}`)
          }
        }
      }

      // Commit transaction
      db.exec('COMMIT')

    } catch (error) {
      // Rollback on error - only if transaction is still active
      try {
        db.exec('ROLLBACK')
      } catch (rollbackError) {
        // Transaction was already committed or rolled back
        console.log('[MIGRATION] Rollback not needed - transaction already closed')
      }

      // Update session status to failed
      session.status = 'failed'
      session.updatedAt = new Date().toISOString()
      migrationSessions.set(sessionId, session)

      console.error('[MIGRATION] Import failed:', error)
      return NextResponse.json({ error: 'Import failed: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 })
    }

    // Post-commit operations (outside transaction)
    // Update session status to completed
    session.status = 'completed'
    session.updatedAt = new Date().toISOString()
    migrationSessions.set(sessionId, session)

    // Log the completed migration
    try {
      db.prepare(`
        INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
        VALUES (?, ?, ?, 'migration', ?, 'complete', ?)
      `).run(uuidv4(), user.company_id, user.id, sessionId, JSON.stringify(results))

      // Create notification
      const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(session.projectId) as { name: string } | undefined
      createNotificationForProjectTeam(
        session.projectId,
        'system',
        'Data Migration Complete',
        `Bulk import completed: ${results.subcontractorsCreated} vendors created, ${results.documentsImported} COCs imported for ${project?.name || 'project'}`,
        `/dashboard/projects/${session.projectId}`,
        'project',
        session.projectId
      )
    } catch (logError) {
      console.error('[MIGRATION] Failed to log/notify, but import succeeded:', logError)
    }

    console.log(`[MIGRATION] Session ${sessionId} completed: ${results.subcontractorsCreated} created, ${results.subcontractorsAssigned} assigned, ${results.documentsImported} COCs imported`)

    return NextResponse.json({
      success: true,
      message: 'Data migration completed successfully',
      results
    })

  } catch (error) {
    console.error('Migration import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
