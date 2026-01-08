import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { sendInvitationEmail } from '@/lib/sendgrid'

// Invitation token expiry: 7 days
const INVITATION_EXPIRY_DAYS = 7

interface InvitationResult {
  success: boolean
  invitationId?: string
  token?: string
  error?: string
}

interface SubcontractorInfo {
  id: string
  name: string
  abn: string
  contact_name: string | null
  contact_email: string | null
}

interface ProjectInfo {
  id: string
  name: string
  state: string | null
  on_site_date?: string | null
}

interface CompanyInfo {
  id: string
  name: string
}

/**
 * Create an invitation token for a subcontractor to access the portal
 */
export function createInvitationToken(
  email: string,
  projectId: string,
  subcontractorId: string
): { token: string; expiresAt: Date } {
  const db = getDb()
  const token = uuidv4()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

  // Invalidate any existing invitation tokens for this email/project combination
  db.prepare(`
    UPDATE magic_link_tokens
    SET used = 1
    WHERE email = ? AND project_id = ? AND type = 'invitation' AND used = 0
  `).run(email.toLowerCase(), projectId)

  // Create new invitation token
  db.prepare(`
    INSERT INTO magic_link_tokens (id, email, token, expires_at, type, project_id, subcontractor_id)
    VALUES (?, ?, ?, ?, 'invitation', ?, ?)
  `).run(
    uuidv4(),
    email.toLowerCase(),
    token,
    expiresAt.toISOString(),
    projectId,
    subcontractorId
  )

  return { token, expiresAt }
}

/**
 * Verify an invitation token
 */
export function verifyInvitationToken(token: string): {
  valid: boolean
  email?: string
  projectId?: string
  subcontractorId?: string
  error?: string
} {
  const db = getDb()

  const invitation = db.prepare(`
    SELECT * FROM magic_link_tokens
    WHERE token = ? AND type = 'invitation'
  `).get(token) as {
    id: string
    email: string
    token: string
    expires_at: string
    used: number
    project_id: string
    subcontractor_id: string
  } | undefined

  if (!invitation) {
    return { valid: false, error: 'Invalid invitation token' }
  }

  if (invitation.used) {
    return { valid: false, error: 'This invitation link has already been used' }
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return { valid: false, error: 'This invitation link has expired' }
  }

  return {
    valid: true,
    email: invitation.email,
    projectId: invitation.project_id,
    subcontractorId: invitation.subcontractor_id
  }
}

/**
 * Mark an invitation token as used
 */
export function markInvitationUsed(token: string): void {
  const db = getDb()
  db.prepare(`
    UPDATE magic_link_tokens
    SET used = 1
    WHERE token = ? AND type = 'invitation'
  `).run(token)
}

/**
 * Send an invitation email to a subcontractor for a specific project
 */
export async function sendSubcontractorInvitation(
  projectId: string,
  subcontractorId: string,
  projectSubcontractorId: string
): Promise<InvitationResult> {
  const db = getDb()

  // Get subcontractor info
  const subcontractor = db.prepare(`
    SELECT id, name, abn, contact_name, contact_email
    FROM subcontractors
    WHERE id = ?
  `).get(subcontractorId) as SubcontractorInfo | undefined

  if (!subcontractor) {
    return { success: false, error: 'Subcontractor not found' }
  }

  if (!subcontractor.contact_email) {
    return { success: false, error: 'Subcontractor has no contact email' }
  }

  // Get project info
  const project = db.prepare(`
    SELECT p.id, p.name, p.state, ps.on_site_date
    FROM projects p
    JOIN project_subcontractors ps ON ps.project_id = p.id
    WHERE p.id = ? AND ps.id = ?
  `).get(projectId, projectSubcontractorId) as ProjectInfo | undefined

  if (!project) {
    return { success: false, error: 'Project not found' }
  }

  // Get company info (the builder)
  const company = db.prepare(`
    SELECT c.id, c.name
    FROM companies c
    JOIN projects p ON p.company_id = c.id
    WHERE p.id = ?
  `).get(projectId) as CompanyInfo | undefined

  if (!company) {
    return { success: false, error: 'Company not found' }
  }

  // Get insurance requirements for display
  const requirements = db.prepare(`
    SELECT coverage_type, minimum_limit
    FROM insurance_requirements
    WHERE project_id = ?
  `).all(projectId) as { coverage_type: string; minimum_limit: number }[]

  const requirementsList = requirements.map(r => {
    const limit = r.minimum_limit >= 1000000
      ? `$${(r.minimum_limit / 1000000).toFixed(0)}M`
      : `$${r.minimum_limit.toLocaleString()}`
    return `${r.coverage_type}: ${limit} minimum`
  })

  // Create invitation token
  const { token, expiresAt } = createInvitationToken(
    subcontractor.contact_email,
    projectId,
    subcontractorId
  )

  // Build invitation link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const invitationLink = `${baseUrl}/portal/verify?token=${token}&type=invitation`

  // Send email
  const emailResult = await sendInvitationEmail({
    recipientEmail: subcontractor.contact_email,
    recipientName: subcontractor.contact_name || subcontractor.name,
    subcontractorName: subcontractor.name,
    subcontractorAbn: subcontractor.abn,
    projectName: project.name,
    builderName: company.name,
    onSiteDate: project.on_site_date || undefined,
    requirements: requirementsList.length > 0 ? requirementsList : undefined,
    invitationLink,
    expiresInDays: INVITATION_EXPIRY_DAYS
  })

  if (!emailResult.success) {
    return { success: false, error: emailResult.error || 'Failed to send email' }
  }

  // Update project_subcontractors with invitation status
  db.prepare(`
    UPDATE project_subcontractors
    SET invitation_sent_at = datetime('now'),
        invitation_status = 'sent'
    WHERE id = ?
  `).run(projectSubcontractorId)

  // Log the action
  db.prepare(`
    INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
    VALUES (?, ?, NULL, 'invitation', ?, 'send', ?)
  `).run(
    uuidv4(),
    company.id,
    projectSubcontractorId,
    JSON.stringify({
      subcontractorId,
      projectId,
      email: subcontractor.contact_email,
      expiresAt: expiresAt.toISOString()
    })
  )

  return {
    success: true,
    invitationId: projectSubcontractorId,
    token
  }
}

/**
 * Resend an invitation email for an existing project-subcontractor assignment
 */
export async function resendInvitation(
  projectSubcontractorId: string
): Promise<InvitationResult> {
  const db = getDb()

  // Get the project-subcontractor assignment
  const assignment = db.prepare(`
    SELECT ps.id, ps.project_id, ps.subcontractor_id
    FROM project_subcontractors ps
    WHERE ps.id = ?
  `).get(projectSubcontractorId) as {
    id: string
    project_id: string
    subcontractor_id: string
  } | undefined

  if (!assignment) {
    return { success: false, error: 'Assignment not found' }
  }

  return sendSubcontractorInvitation(
    assignment.project_id,
    assignment.subcontractor_id,
    projectSubcontractorId
  )
}
