import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination'

// GET /api/subcontractors - List all subcontractors for the company
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
    const { searchParams } = new URL(request.url)
    const { page, limit, offset } = parsePaginationParams(searchParams)

    // Get total count first
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM subcontractors s
      WHERE s.company_id = ?
    `).get(user.company_id) as { total: number }
    const total = countResult.total

    // Get paginated subcontractors for the company (only count active project assignments)
    const subcontractors = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM project_subcontractors ps
         JOIN projects p ON ps.project_id = p.id
         WHERE ps.subcontractor_id = s.id AND p.status != 'completed') as project_count
      FROM subcontractors s
      WHERE s.company_id = ?
      ORDER BY s.name ASC
      LIMIT ? OFFSET ?
    `).all(user.company_id, limit, offset)

    // Return both old format for backward compatibility and new paginated format
    const paginatedResponse = createPaginatedResponse(subcontractors, total, { page, limit, offset })
    return NextResponse.json({
      subcontractors,  // Backward compatibility
      total,           // Backward compatibility (was subcontractors.length before)
      ...paginatedResponse  // New pagination structure
    })
  } catch (error) {
    console.error('Get subcontractors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/subcontractors - Create a new subcontractor
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

    // Only admin, risk_manager, project_manager can create subcontractors
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins, risk managers, and project managers can create subcontractors' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      abn,
      tradingName,
      trade,
      address,
      contactName,
      contactEmail,
      contactPhone,
      brokerName,
      brokerEmail,
      brokerPhone
    } = body

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Subcontractor name is required' }, { status: 400 })
    }

    if (!abn?.trim()) {
      return NextResponse.json({ error: 'ABN is required' }, { status: 400 })
    }

    // Validate ABN format (11 digits)
    const cleanedABN = abn.replace(/\s/g, '')
    if (!/^\d{11}$/.test(cleanedABN)) {
      return NextResponse.json({ error: 'ABN must be exactly 11 digits' }, { status: 400 })
    }

    // Validate ABN using Australian checksum algorithm
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
    const digits = cleanedABN.split('').map(Number)
    digits[0] = digits[0] - 1 // Subtract 1 from first digit
    const sum = digits.reduce((acc: number, digit: number, i: number) => acc + digit * weights[i], 0)
    if (sum % 89 !== 0) {
      return NextResponse.json({ error: 'Invalid ABN checksum - please verify the ABN is correct' }, { status: 400 })
    }

    const db = getDb()

    // Check if ABN already exists for this company
    const existingSub = db.prepare('SELECT id FROM subcontractors WHERE company_id = ? AND abn = ?').get(user.company_id, cleanedABN)
    if (existingSub) {
      return NextResponse.json({ error: 'A subcontractor with this ABN already exists' }, { status: 409 })
    }

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
      name.trim(),
      cleanedABN,
      tradingName?.trim() || null,
      trade?.trim() || null,
      address?.trim() || null,
      contactName?.trim() || null,
      contactEmail?.toLowerCase().trim() || null,
      contactPhone?.trim() || null,
      brokerName?.trim() || null,
      brokerEmail?.toLowerCase().trim() || null,
      brokerPhone?.trim() || null
    )

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'subcontractor', ?, 'create', ?)
    `).run(uuidv4(), user.company_id, user.id, subcontractorId, JSON.stringify({ name: name.trim(), abn: cleanedABN }))

    // Get the created subcontractor
    const subcontractor = db.prepare('SELECT * FROM subcontractors WHERE id = ?').get(subcontractorId)

    return NextResponse.json({
      success: true,
      message: 'Subcontractor created successfully',
      subcontractor
    }, { status: 201 })

  } catch (error) {
    console.error('Create subcontractor error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
