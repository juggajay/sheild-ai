import { NextRequest, NextResponse } from 'next/server'
import { getDb, type Company } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

// GET /api/company - Get current user's company profile
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

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const db = getDb()
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(user.company_id) as Company | undefined

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json({ company })
  } catch (error) {
    console.error('Get company error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/company - Update company profile (admin only)
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admin can update company profile
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only administrators can update company profile' }, { status: 403 })
    }

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const body = await request.json()
    const { name, abn, acn, address, logo_url, primary_contact_name, primary_contact_email, primary_contact_phone } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    if (!abn || typeof abn !== 'string' || abn.trim().length === 0) {
      return NextResponse.json({ error: 'ABN is required' }, { status: 400 })
    }

    // Validate ABN format (11 digits)
    const abnDigits = abn.replace(/\s/g, '')
    if (!/^\d{11}$/.test(abnDigits)) {
      return NextResponse.json({ error: 'ABN must be 11 digits' }, { status: 400 })
    }

    // Validate ACN format if provided (9 digits)
    if (acn) {
      const acnDigits = acn.replace(/\s/g, '')
      if (!/^\d{9}$/.test(acnDigits)) {
        return NextResponse.json({ error: 'ACN must be 9 digits' }, { status: 400 })
      }
    }

    // Validate email format if provided
    if (primary_contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primary_contact_email)) {
      return NextResponse.json({ error: 'Invalid contact email format' }, { status: 400 })
    }

    const db = getDb()

    // Check if ABN is already used by another company
    const existingCompany = db.prepare('SELECT id FROM companies WHERE abn = ? AND id != ?').get(abnDigits, user.company_id) as { id: string } | undefined
    if (existingCompany) {
      return NextResponse.json({ error: 'ABN is already registered to another company' }, { status: 400 })
    }

    // Update company
    db.prepare(`
      UPDATE companies SET
        name = ?,
        abn = ?,
        acn = ?,
        address = ?,
        logo_url = ?,
        primary_contact_name = ?,
        primary_contact_email = ?,
        primary_contact_phone = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name.trim(),
      abnDigits,
      acn ? acn.replace(/\s/g, '') : null,
      address || null,
      logo_url || null,
      primary_contact_name || null,
      primary_contact_email || null,
      primary_contact_phone || null,
      user.company_id
    )

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'company', ?, 'update', ?)
    `).run(uuidv4(), user.company_id, user.id, user.company_id, JSON.stringify({
      fields_updated: Object.keys(body)
    }))

    // Get updated company
    const updatedCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(user.company_id) as Company

    return NextResponse.json({
      success: true,
      message: 'Company profile updated successfully',
      company: updatedCompany
    })
  } catch (error) {
    console.error('Update company error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
