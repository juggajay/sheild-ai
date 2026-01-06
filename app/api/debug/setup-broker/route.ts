import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// POST /api/debug/setup-broker - Set up a broker test email for testing
// This is a debug endpoint for development/testing only
export async function POST(request: NextRequest) {
  try {
    const { brokerEmail, subcontractorId } = await request.json()

    if (!brokerEmail) {
      return NextResponse.json({ error: 'brokerEmail required' }, { status: 400 })
    }

    const db = getDb()

    // If subcontractorId is provided, assign broker to that specific subcontractor
    if (subcontractorId) {
      db.prepare(`
        UPDATE subcontractors SET broker_email = ? WHERE id = ?
      `).run(brokerEmail, subcontractorId)

      const updated = db.prepare(`
        SELECT id, name, broker_email FROM subcontractors WHERE id = ?
      `).get(subcontractorId)

      return NextResponse.json({
        message: `Assigned subcontractor ${subcontractorId} to broker ${brokerEmail}`,
        client: updated
      })
    }

    // Get first few subcontractors that don't have a broker email set
    const subcontractors = db.prepare(`
      SELECT id, name, broker_email FROM subcontractors
      WHERE broker_email IS NULL OR broker_email = ''
      LIMIT 3
    `).all() as Array<{ id: string; name: string; broker_email: string | null }>

    if (subcontractors.length === 0) {
      // Check if any already have this broker email
      const existing = db.prepare(`
        SELECT id, name, broker_email FROM subcontractors
        WHERE broker_email = ?
      `).all(brokerEmail) as Array<{ id: string; name: string; broker_email: string }>

      if (existing.length > 0) {
        return NextResponse.json({
          message: 'Broker already has clients assigned',
          clients: existing
        })
      }

      return NextResponse.json({ error: 'No subcontractors available to assign' }, { status: 400 })
    }

    // Assign broker_email to these subcontractors
    const updateStmt = db.prepare(`
      UPDATE subcontractors SET broker_email = ? WHERE id = ?
    `)

    for (const sub of subcontractors) {
      updateStmt.run(brokerEmail, sub.id)
    }

    // Fetch updated data
    const updated = db.prepare(`
      SELECT id, name, broker_email FROM subcontractors WHERE broker_email = ?
    `).all(brokerEmail)

    return NextResponse.json({
      message: `Assigned ${subcontractors.length} subcontractors to broker ${brokerEmail}`,
      clients: updated
    })

  } catch (error) {
    console.error('Setup broker error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - check current broker assignments
export async function GET(request: NextRequest) {
  try {
    const db = getDb()

    // Get all subcontractors with broker_email set (include project count)
    const withBrokers = db.prepare(`
      SELECT s.id, s.name, s.broker_email, s.contact_email,
        (SELECT COUNT(*) FROM project_subcontractors ps WHERE ps.subcontractor_id = s.id) as project_count
      FROM subcontractors s
      WHERE s.broker_email IS NOT NULL AND s.broker_email != ''
    `).all()

    // Get all subcontractors without broker_email (include project count)
    const withoutBrokers = db.prepare(`
      SELECT s.id, s.name, s.contact_email,
        (SELECT COUNT(*) FROM project_subcontractors ps WHERE ps.subcontractor_id = s.id) as project_count
      FROM subcontractors s
      WHERE s.broker_email IS NULL OR s.broker_email = ''
    `).all()

    return NextResponse.json({
      withBrokers,
      withoutBrokers
    })

  } catch (error) {
    console.error('Get broker data error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
