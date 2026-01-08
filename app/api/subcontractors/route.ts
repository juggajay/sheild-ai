import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, isProduction, getSupabase } from '@/lib/db'
import { getUserByToken, getUserByTokenAsync } from '@/lib/auth'
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination'

// GET /api/subcontractors - List all subcontractors for the company
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = isProduction ? await getUserByTokenAsync(token) : getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { page, limit, offset } = parsePaginationParams(searchParams)

    let subcontractors: any[]
    let total: number

    if (isProduction) {
      // Production: Use Supabase
      const supabase = getSupabase()

      const { data, error, count } = await supabase
        .from('subcontractors')
        .select('*', { count: 'exact' })
        .eq('company_id', user.company_id)
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1)

      if (error) throw error

      // Get project counts for each subcontractor
      const subIds = (data || []).map((s: any) => s.id)
      const { data: projectCounts } = await supabase
        .from('project_subcontractors')
        .select('subcontractor_id, projects!inner(status)')
        .in('subcontractor_id', subIds)
        .neq('projects.status', 'completed')

      const countMap = new Map<string, number>()
      for (const pc of projectCounts || []) {
        countMap.set(pc.subcontractor_id, (countMap.get(pc.subcontractor_id) || 0) + 1)
      }

      subcontractors = (data || []).map((s: any) => ({
        ...s,
        project_count: countMap.get(s.id) || 0
      }))
      total = count || 0

    } else {
      // Development: Use SQLite
      const db = getDb()

      const countResult = db.prepare(`
        SELECT COUNT(*) as total FROM subcontractors s WHERE s.company_id = ?
      `).get(user.company_id) as { total: number }
      total = countResult.total

      subcontractors = db.prepare(`
        SELECT s.*,
          (SELECT COUNT(*) FROM project_subcontractors ps
           JOIN projects p ON ps.project_id = p.id
           WHERE ps.subcontractor_id = s.id AND p.status != 'completed') as project_count
        FROM subcontractors s
        WHERE s.company_id = ?
        ORDER BY s.name ASC
        LIMIT ? OFFSET ?
      `).all(user.company_id, limit, offset)
    }

    const paginatedResponse = createPaginatedResponse(subcontractors, total, { page, limit, offset })
    return NextResponse.json({
      subcontractors,
      total,
      ...paginatedResponse
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

    const user = isProduction ? await getUserByTokenAsync(token) : getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admin, risk_manager, project_manager can create subcontractors
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins, risk managers, and project managers can create subcontractors' }, { status: 403 })
    }

    const body = await request.json()
    const { name, abn, tradingName, trade, address, contactName, contactEmail, contactPhone, brokerName, brokerEmail, brokerPhone } = body

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
    digits[0] = digits[0] - 1
    const sum = digits.reduce((acc: number, digit: number, i: number) => acc + digit * weights[i], 0)
    if (sum % 89 !== 0) {
      return NextResponse.json({ error: 'Invalid ABN checksum - please verify the ABN is correct' }, { status: 400 })
    }

    const subcontractorId = uuidv4()
    let subcontractor

    if (isProduction) {
      // Production: Use Supabase
      const supabase = getSupabase()

      // Check if ABN already exists
      const { data: existingSub } = await supabase.from('subcontractors').select('id').eq('company_id', user.company_id).eq('abn', cleanedABN).single()
      if (existingSub) {
        return NextResponse.json({ error: 'A subcontractor with this ABN already exists' }, { status: 409 })
      }

      const { data, error } = await supabase.from('subcontractors').insert({
        id: subcontractorId,
        company_id: user.company_id,
        name: name.trim(),
        abn: cleanedABN,
        trading_name: tradingName?.trim() || null,
        trade: trade?.trim() || null,
        address: address?.trim() || null,
        contact_name: contactName?.trim() || null,
        contact_email: contactEmail?.toLowerCase().trim() || null,
        contact_phone: contactPhone?.trim() || null,
        broker_name: brokerName?.trim() || null,
        broker_email: brokerEmail?.toLowerCase().trim() || null,
        broker_phone: brokerPhone?.trim() || null
      }).select().single()

      if (error) throw error
      subcontractor = data

      await supabase.from('audit_logs').insert({
        id: uuidv4(),
        company_id: user.company_id,
        user_id: user.id,
        entity_type: 'subcontractor',
        entity_id: subcontractorId,
        action: 'create',
        details: { name: name.trim(), abn: cleanedABN }
      })

    } else {
      // Development: Use SQLite
      const db = getDb()

      const existingSub = db.prepare('SELECT id FROM subcontractors WHERE company_id = ? AND abn = ?').get(user.company_id, cleanedABN)
      if (existingSub) {
        return NextResponse.json({ error: 'A subcontractor with this ABN already exists' }, { status: 409 })
      }

      db.prepare(`
        INSERT INTO subcontractors (id, company_id, name, abn, trading_name, trade, address, contact_name, contact_email, contact_phone, broker_name, broker_email, broker_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(subcontractorId, user.company_id, name.trim(), cleanedABN, tradingName?.trim() || null, trade?.trim() || null, address?.trim() || null, contactName?.trim() || null, contactEmail?.toLowerCase().trim() || null, contactPhone?.trim() || null, brokerName?.trim() || null, brokerEmail?.toLowerCase().trim() || null, brokerPhone?.trim() || null)

      db.prepare(`
        INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
        VALUES (?, ?, ?, 'subcontractor', ?, 'create', ?)
      `).run(uuidv4(), user.company_id, user.id, subcontractorId, JSON.stringify({ name: name.trim(), abn: cleanedABN }))

      subcontractor = db.prepare('SELECT * FROM subcontractors WHERE id = ?').get(subcontractorId)
    }

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
