import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

// Valid ABN generator with checksum
function generateValidABN(): string {
  // Generate first 10 random digits
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10))

  // Calculate the check digit (first digit)
  // ABN algorithm: weights are [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  // First digit - 1 is multiplied by 10, then others by their weights
  // Sum must be divisible by 89

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]

  // Try different first digits until we find one that makes a valid checksum
  for (let firstDigit = 1; firstDigit <= 9; firstDigit++) {
    const testDigits = [firstDigit, ...digits]
    const adjustedDigits = [...testDigits]
    adjustedDigits[0] = adjustedDigits[0] - 1

    const sum = adjustedDigits.reduce((acc, digit, i) => acc + digit * weights[i], 0)
    if (sum % 89 === 0) {
      return testDigits.join('')
    }
  }

  // Fallback: use a known valid ABN pattern
  return '51824753556' // Commonwealth Bank ABN
}

const TRADES = [
  'Electrical', 'Plumbing', 'HVAC', 'Carpentry', 'Concrete',
  'Steel Fabrication', 'Roofing', 'Glazing', 'Painting', 'Flooring',
  'Landscaping', 'Demolition', 'Scaffolding', 'Crane Services', 'Fire Protection',
  'Waterproofing', 'Tiling', 'Joinery', 'Metalwork', 'Insulation'
]

const COMPANY_SUFFIXES = ['Pty Ltd', 'Services', 'Solutions', 'Group', 'Contractors', 'Industries']

// POST /api/test/generate-data - Generate test data for performance testing
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

    // Only admin can generate test data
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can generate test data' }, { status: 403 })
    }

    const body = await request.json()
    const { count = 100 } = body

    const db = getDb()

    // Check existing count
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM subcontractors WHERE company_id = ?').get(user.company_id) as { count: number }

    // Generate unique ABNs
    const existingABNs = new Set<string>(
      (db.prepare('SELECT abn FROM subcontractors WHERE company_id = ?').all(user.company_id) as { abn: string }[]).map(s => s.abn)
    )

    const created: string[] = []
    const stmt = db.prepare(`
      INSERT INTO subcontractors (
        id, company_id, name, abn, trading_name, trade, address,
        contact_name, contact_email, contact_phone,
        broker_name, broker_email, broker_phone
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let attempts = 0
    const maxAttempts = count * 10

    while (created.length < count && attempts < maxAttempts) {
      attempts++

      // Generate a valid ABN
      let abn = generateValidABN()

      // Make sure it's unique by modifying the middle digits slightly
      let uniqueAttempts = 0
      while (existingABNs.has(abn) && uniqueAttempts < 100) {
        // Generate a new one
        abn = generateValidABN()
        uniqueAttempts++
      }

      if (existingABNs.has(abn)) {
        continue // Skip if we couldn't generate a unique ABN
      }

      existingABNs.add(abn)

      const trade = TRADES[Math.floor(Math.random() * TRADES.length)]
      const suffix = COMPANY_SUFFIXES[Math.floor(Math.random() * COMPANY_SUFFIXES.length)]
      const companyNumber = created.length + existingCount.count + 1
      const name = `Performance Test ${trade} ${suffix} ${companyNumber}`

      const subcontractorId = uuidv4()

      try {
        stmt.run(
          subcontractorId,
          user.company_id,
          name,
          abn,
          `${trade} Specialists`,
          trade,
          `${100 + created.length} Test Street, Sydney NSW 2000`,
          `Contact Person ${companyNumber}`,
          `contact${companyNumber}@perftest.example.com`,
          `0400${String(companyNumber).padStart(6, '0')}`,
          `Broker ${companyNumber}`,
          `broker${companyNumber}@perftest.example.com`,
          `0411${String(companyNumber).padStart(6, '0')}`
        )
        created.push(name)
      } catch (err) {
        // Skip duplicates
        console.error('Error creating subcontractor:', err)
      }
    }

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'test_data', ?, 'generate', ?)
    `).run(uuidv4(), user.company_id, user.id, 'bulk', JSON.stringify({ count: created.length, type: 'subcontractors' }))

    // Get final count
    const finalCount = db.prepare('SELECT COUNT(*) as count FROM subcontractors WHERE company_id = ?').get(user.company_id) as { count: number }

    return NextResponse.json({
      success: true,
      message: `Created ${created.length} test subcontractors`,
      previousCount: existingCount.count,
      newCount: finalCount.count,
      created: created.length
    })

  } catch (error) {
    console.error('Generate test data error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/test/generate-data - Remove test data
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admin can delete test data
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete test data' }, { status: 403 })
    }

    const db = getDb()

    // Delete subcontractors with "Performance Test" in their name
    const result = db.prepare(`
      DELETE FROM subcontractors
      WHERE company_id = ? AND name LIKE 'Performance Test%'
    `).run(user.company_id)

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.changes} test subcontractors`,
      deleted: result.changes
    })

  } catch (error) {
    console.error('Delete test data error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
