import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

// POST /api/communications/resend - Resend a follow-up communication for a failed verification
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

    const body = await request.json()
    const { verificationId, subcontractorId, projectId } = body

    if (!verificationId || !subcontractorId || !projectId) {
      return NextResponse.json({ error: 'verificationId, subcontractorId, and projectId are required' }, { status: 400 })
    }

    const db = getDb()

    // Verify project belongs to user's company
    const project = db.prepare(`
      SELECT id, name FROM projects WHERE id = ? AND company_id = ?
    `).get(projectId, user.company_id) as { id: string; name: string } | undefined

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get verification and subcontractor info
    const verification = db.prepare(`
      SELECT v.*, d.file_name
      FROM verifications v
      JOIN coc_documents d ON v.coc_document_id = d.id
      WHERE v.id = ?
    `).get(verificationId) as {
      id: string
      status: string
      deficiencies: string
      file_name: string
    } | undefined

    if (!verification) {
      return NextResponse.json({ error: 'Verification not found' }, { status: 404 })
    }

    const subcontractor = db.prepare(`
      SELECT id, name, contact_email FROM subcontractors WHERE id = ?
    `).get(subcontractorId) as { id: string; name: string; contact_email: string | null } | undefined

    if (!subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Parse deficiencies for the email
    let deficiencies: Array<{ check_name: string; message: string }> = []
    try {
      deficiencies = JSON.parse(verification.deficiencies || '[]')
    } catch {
      deficiencies = []
    }

    const deficiencyList = deficiencies.map(d => `- ${d.check_name}: ${d.message}`).join('\n')

    // Create a follow-up communication record
    const communicationId = uuidv4()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO communications (
        id, subcontractor_id, project_id, verification_id,
        type, channel, recipient_email, subject, body,
        status, sent_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      communicationId,
      subcontractorId,
      projectId,
      verificationId,
      'follow_up',
      'email',
      subcontractor.contact_email,
      `Follow-up: Insurance Certificate Required - ${project.name}`,
      `Dear ${subcontractor.name},

This is a follow-up regarding your Certificate of Currency for project "${project.name}".

We previously notified you of deficiencies with your submitted insurance certificate. We have not yet received an updated certificate addressing these issues.

Original Issues:
${deficiencyList || 'Please contact us for details.'}

Please submit an updated Certificate of Currency as soon as possible to maintain compliance.

If you have already submitted an updated certificate, please disregard this message.

Thank you for your prompt attention to this matter.

Best regards,
${user.company?.name || 'The Compliance Team'}`,
      'sent', // Mark as sent (in production, this would queue for actual sending)
      now,
      now,
      now
    )

    // Log the audit entry
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      user.company_id,
      user.id,
      'communication',
      communicationId,
      'resend',
      JSON.stringify({
        verification_id: verificationId,
        subcontractor_name: subcontractor.name,
        project_name: project.name,
        type: 'follow_up'
      }),
      now
    )

    return NextResponse.json({
      success: true,
      message: 'Follow-up communication sent',
      communication: {
        id: communicationId,
        type: 'follow_up',
        recipient: subcontractor.contact_email,
        sent_at: now
      }
    })

  } catch (error) {
    console.error('Resend communication error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
