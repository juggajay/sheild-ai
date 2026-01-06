import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

// ABN validation helper
function validateABNChecksum(abn: string): boolean {
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  const digits = abn.split('').map(Number)
  digits[0] = digits[0] - 1 // Subtract 1 from first digit
  const sum = digits.reduce((acc, digit, i) => acc + digit * weights[i], 0)
  return sum % 89 === 0
}

interface SubcontractorImport {
  name: string
  abn: string
  tradingName?: string
  trade?: string
  address?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  brokerName?: string
  brokerEmail?: string
  brokerPhone?: string
}

interface DuplicateRecord {
  rowNum: number
  importData: SubcontractorImport
  existingId: string
  existingName: string
  cleanedABN: string
}

// POST /api/subcontractors/import - Bulk import subcontractors
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

    // Only admin, risk_manager, project_manager can import subcontractors
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins, risk managers, and project managers can import subcontractors' }, { status: 403 })
    }

    const body = await request.json()
    const { subcontractors, mergeIds } = body as {
      subcontractors: SubcontractorImport[]
      mergeIds?: string[] // IDs of existing subcontractors to merge/update
    }

    if (!subcontractors || !Array.isArray(subcontractors) || subcontractors.length === 0) {
      return NextResponse.json({ error: 'No subcontractors to import' }, { status: 400 })
    }

    const db = getDb()
    const created: string[] = []
    const merged: string[] = []
    const errors: string[] = []
    const duplicates: DuplicateRecord[] = []

    for (let i = 0; i < subcontractors.length; i++) {
      const sub = subcontractors[i]
      const rowNum = i + 1

      // Validate required fields
      if (!sub.name?.trim()) {
        errors.push(`Row ${rowNum}: Company name is required`)
        continue
      }

      if (!sub.abn?.trim()) {
        errors.push(`Row ${rowNum}: ABN is required`)
        continue
      }

      // Clean and validate ABN
      const cleanedABN = sub.abn.replace(/\s/g, '')

      if (!/^\d{11}$/.test(cleanedABN)) {
        errors.push(`Row ${rowNum} (${sub.name}): ABN must be exactly 11 digits`)
        continue
      }

      if (!validateABNChecksum(cleanedABN)) {
        errors.push(`Row ${rowNum} (${sub.name}): Invalid ABN checksum`)
        continue
      }

      // Check if ABN already exists
      const existingSub = db.prepare('SELECT id, name FROM subcontractors WHERE company_id = ? AND abn = ?').get(user.company_id, cleanedABN) as { id: string; name: string } | undefined

      if (existingSub) {
        // Check if user wants to merge this duplicate
        if (mergeIds && mergeIds.includes(existingSub.id)) {
          // Merge/update existing record
          try {
            db.prepare(`
              UPDATE subcontractors SET
                name = COALESCE(?, name),
                trading_name = COALESCE(?, trading_name),
                trade = COALESCE(?, trade),
                address = COALESCE(?, address),
                contact_name = COALESCE(?, contact_name),
                contact_email = COALESCE(?, contact_email),
                contact_phone = COALESCE(?, contact_phone),
                broker_name = COALESCE(?, broker_name),
                broker_email = COALESCE(?, broker_email),
                broker_phone = COALESCE(?, broker_phone),
                updated_at = datetime('now')
              WHERE id = ? AND company_id = ?
            `).run(
              sub.name.trim() || null,
              sub.tradingName?.trim() || null,
              sub.trade?.trim() || null,
              sub.address?.trim() || null,
              sub.contactName?.trim() || null,
              sub.contactEmail?.toLowerCase().trim() || null,
              sub.contactPhone?.trim() || null,
              sub.brokerName?.trim() || null,
              sub.brokerEmail?.toLowerCase().trim() || null,
              sub.brokerPhone?.trim() || null,
              existingSub.id,
              user.company_id
            )
            merged.push(existingSub.id)
          } catch (err) {
            errors.push(`Row ${rowNum} (${sub.name}): Failed to merge`)
            console.error(`Merge error for row ${rowNum}:`, err)
          }
        } else {
          // Track as duplicate for user to decide
          duplicates.push({
            rowNum,
            importData: sub,
            existingId: existingSub.id,
            existingName: existingSub.name,
            cleanedABN
          })
        }
        continue
      }

      try {
        // Create subcontractor
        const subcontractorId = uuidv4()

        db.prepare(`
          INSERT INTO subcontractors (
            id, company_id, name, abn, trading_name, trade, address,
            contact_name, contact_email, contact_phone,
            broker_name, broker_email, broker_phone
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          subcontractorId,
          user.company_id,
          sub.name.trim(),
          cleanedABN,
          sub.tradingName?.trim() || null,
          sub.trade?.trim() || null,
          sub.address?.trim() || null,
          sub.contactName?.trim() || null,
          sub.contactEmail?.toLowerCase().trim() || null,
          sub.contactPhone?.trim() || null,
          sub.brokerName?.trim() || null,
          sub.brokerEmail?.toLowerCase().trim() || null,
          sub.brokerPhone?.trim() || null
        )

        created.push(subcontractorId)
      } catch (err) {
        errors.push(`Row ${rowNum} (${sub.name}): Database error`)
        console.error(`Import error for row ${rowNum}:`, err)
      }
    }

    // Log the bulk import action
    if (created.length > 0 || merged.length > 0) {
      db.prepare(`
        INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
        VALUES (?, ?, ?, 'subcontractor', ?, 'bulk_import', ?)
      `).run(
        uuidv4(),
        user.company_id,
        user.id,
        created[0] || merged[0], // Reference first created/merged ID
        JSON.stringify({
          created: created.length,
          merged: merged.length,
          total: subcontractors.length,
          errors: errors.length,
          duplicates: duplicates.length
        })
      )
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      merged: merged.length,
      total: subcontractors.length,
      errors: errors.length > 0 ? errors : undefined,
      duplicates: duplicates.length > 0 ? duplicates : undefined
    })

  } catch (error) {
    console.error('Bulk import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
