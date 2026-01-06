import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { validateSession } from '@/lib/auth'

interface ExpirationRecord {
  id: string
  subcontractor_id: string
  subcontractor_name: string
  project_id: string
  project_name: string
  coc_document_id: string
  file_name: string | null
  policy_number: string
  insurer_name: string
  expiry_date: string
  days_until_expiry: number
  status: 'expired' | 'expiring_soon' | 'valid'
}

// GET /api/expirations - Get expiration calendar data
export async function GET(request: NextRequest) {
  try {
    // Validate session
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = validateSession(token)
    if (!session.valid) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const db = getDb()
    const { searchParams } = new URL(request.url)

    // Optional filters
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || (() => {
      const d = new Date()
      d.setMonth(d.getMonth() + 3) // Default to 3 months ahead
      return d.toISOString().split('T')[0]
    })()
    const projectId = searchParams.get('projectId')

    // Get all verifications with expiry dates
    let query = `
      SELECT
        v.id,
        v.coc_document_id,
        v.project_id,
        v.extracted_data,
        coc.file_name,
        coc.subcontractor_id,
        s.name as subcontractor_name,
        p.name as project_name
      FROM verifications v
      JOIN coc_documents coc ON v.coc_document_id = coc.id
      JOIN subcontractors s ON coc.subcontractor_id = s.id
      JOIN projects p ON v.project_id = p.id
      WHERE v.status IN ('pass', 'review')
    `

    const params: string[] = []

    if (projectId) {
      query += ` AND v.project_id = ?`
      params.push(projectId)
    }

    const verifications = db.prepare(query).all(...params) as Array<{
      id: string
      coc_document_id: string
      project_id: string
      extracted_data: string
      file_name: string | null
      subcontractor_id: string
      subcontractor_name: string
      project_name: string
    }>

    // Process and filter expirations
    const expirations: ExpirationRecord[] = []
    const now = new Date()
    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)

    for (const v of verifications) {
      try {
        const extractedData = JSON.parse(v.extracted_data)
        const expiryDateStr = extractedData.period_of_insurance_end

        if (!expiryDateStr) continue

        const expiryDate = new Date(expiryDateStr)

        // Filter by date range
        if (expiryDate < startDateObj || expiryDate > endDateObj) continue

        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        let status: 'expired' | 'expiring_soon' | 'valid' = 'valid'
        if (daysUntilExpiry < 0) {
          status = 'expired'
        } else if (daysUntilExpiry <= 30) {
          status = 'expiring_soon'
        }

        expirations.push({
          id: v.id,
          subcontractor_id: v.subcontractor_id,
          subcontractor_name: v.subcontractor_name,
          project_id: v.project_id,
          project_name: v.project_name,
          coc_document_id: v.coc_document_id,
          file_name: v.file_name,
          policy_number: extractedData.policy_number || 'Unknown',
          insurer_name: extractedData.insurer_name || 'Unknown',
          expiry_date: expiryDateStr,
          days_until_expiry: daysUntilExpiry,
          status
        })
      } catch (e) {
        console.error('Error parsing verification data:', e)
      }
    }

    // Sort by expiry date
    expirations.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())

    // Group by date for calendar view
    const byDate: Record<string, ExpirationRecord[]> = {}
    for (const exp of expirations) {
      const dateKey = exp.expiry_date
      if (!byDate[dateKey]) {
        byDate[dateKey] = []
      }
      byDate[dateKey].push(exp)
    }

    // Calculate summary
    const summary = {
      total: expirations.length,
      expired: expirations.filter(e => e.status === 'expired').length,
      expiringSoon: expirations.filter(e => e.status === 'expiring_soon').length,
      valid: expirations.filter(e => e.status === 'valid').length
    }

    return NextResponse.json({
      expirations,
      byDate,
      summary,
      dateRange: {
        start: startDate,
        end: endDate
      }
    })

  } catch (error) {
    console.error('Get expirations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/expirations/remind - Send bulk reminder for selected expirations
export async function POST(request: NextRequest) {
  try {
    // Validate session
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = validateSession(token)
    if (!session.valid) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { expirationIds } = await request.json()

    if (!expirationIds || !Array.isArray(expirationIds) || expirationIds.length === 0) {
      return NextResponse.json({ error: 'Expiration IDs required' }, { status: 400 })
    }

    const db = getDb()
    const { v4: uuidv4 } = await import('uuid')

    let sentCount = 0
    const results: Array<{ id: string; success: boolean; error?: string }> = []

    for (const verificationId of expirationIds) {
      try {
        // Get verification details
        const verification = db.prepare(`
          SELECT
            v.id,
            v.project_id,
            v.extracted_data,
            coc.subcontractor_id,
            s.name as subcontractor_name,
            s.contact_email,
            s.broker_email,
            p.name as project_name
          FROM verifications v
          JOIN coc_documents coc ON v.coc_document_id = coc.id
          JOIN subcontractors s ON coc.subcontractor_id = s.id
          JOIN projects p ON v.project_id = p.id
          WHERE v.id = ?
        `).get(verificationId) as {
          id: string
          project_id: string
          extracted_data: string
          subcontractor_id: string
          subcontractor_name: string
          contact_email: string | null
          broker_email: string | null
          project_name: string
        } | undefined

        if (!verification) {
          results.push({ id: verificationId, success: false, error: 'Verification not found' })
          continue
        }

        const recipientEmail = verification.contact_email || verification.broker_email
        if (!recipientEmail) {
          results.push({ id: verificationId, success: false, error: 'No recipient email' })
          continue
        }

        const extractedData = JSON.parse(verification.extracted_data)
        const expiryDate = extractedData.period_of_insurance_end

        // Create communication record
        const commId = uuidv4()
        db.prepare(`
          INSERT INTO communications (id, subcontractor_id, project_id, type, subject, body, status, sent_at)
          VALUES (?, ?, ?, 'expiration_reminder', ?, ?, 'sent', datetime('now'))
        `).run(
          commId,
          verification.subcontractor_id,
          verification.project_id,
          `Certificate of Currency Expiring - ${verification.project_name}`,
          `Your Certificate of Currency for ${verification.project_name} expires on ${expiryDate}. Please upload a renewed certificate to maintain compliance.`
        )

        results.push({ id: verificationId, success: true })
        sentCount++
      } catch (err) {
        console.error('Error sending reminder:', err)
        results.push({ id: verificationId, success: false, error: 'Failed to send' })
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      totalRequested: expirationIds.length,
      results
    })

  } catch (error) {
    console.error('Send reminder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
