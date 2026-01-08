import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { getDb, getSupabase, isProduction, type User, type Session } from './db'

const JWT_SECRET = process.env.JWT_SECRET

// Validate JWT_SECRET at startup
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production')
  }
  console.warn('WARNING: JWT_SECRET not set. Using insecure development secret.')
}

/**
 * Get the JWT secret, throwing in production if not set
 */
export function getJwtSecret(): string {
  if (JWT_SECRET) return JWT_SECRET
  if (process.env.NODE_ENV !== 'production') {
    return 'riskshield-development-secret-key-DO-NOT-USE-IN-PRODUCTION'
  }
  throw new Error('JWT_SECRET must be set')
}

const SESSION_DURATION = 8 * 60 * 60 * 1000 // 8 hours in milliseconds

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

/**
 * Compare password with hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Validate password requirements
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Create a session for a user
 */
export function createSession(userId: string): { session: Session; token: string } {
  const db = getDb()
  const sessionId = uuidv4()
  const token = jwt.sign({ sessionId, userId }, getJwtSecret(), { expiresIn: '8h' })
  const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString()

  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `)
  stmt.run(sessionId, userId, token, expiresAt)

  const session: Session = {
    id: sessionId,
    user_id: userId,
    token,
    expires_at: expiresAt,
    created_at: new Date().toISOString()
  }

  return { session, token }
}

/**
 * Create a session for a user (async version for Supabase)
 */
export async function createSessionAsync(userId: string): Promise<{ session: Session; token: string }> {
  const sessionId = uuidv4()
  const token = jwt.sign({ sessionId, userId }, getJwtSecret(), { expiresIn: '8h' })
  const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString()

  const supabase = getSupabase()
  await supabase.from('sessions').insert({
    id: sessionId,
    user_id: userId,
    token,
    expires_at: expiresAt,
    created_at: new Date().toISOString()
  })

  const session: Session = {
    id: sessionId,
    user_id: userId,
    token,
    expires_at: expiresAt,
    created_at: new Date().toISOString()
  }

  return { session, token }
}

/**
 * Validate a session token (async version for Supabase)
 */
export async function validateSessionAsync(token: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { sessionId: string; userId: string }
    const supabase = getSupabase()

    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', decoded.sessionId)
      .eq('token', token)
      .single()

    if (error || !session) {
      return { valid: false, error: 'Session not found' }
    }

    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      await supabase.from('sessions').delete().eq('id', session.id)
      return { valid: false, error: 'Session expired' }
    }

    return { valid: true, userId: session.user_id }
  } catch (error) {
    return { valid: false, error: 'Invalid token' }
  }
}

/**
 * Get user by session token (async version for Supabase)
 */
export async function getUserByTokenAsync(token: string): Promise<User | null> {
  const validation = await validateSessionAsync(token)
  if (!validation.valid || !validation.userId) {
    return null
  }

  const supabase = getSupabase()
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', validation.userId)
    .single()

  if (error || !user) return null
  return user as User
}

/**
 * Validate a session token
 */
export function validateSession(token: string): { valid: boolean; userId?: string; error?: string } {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { sessionId: string; userId: string }
    const db = getDb()

    const session = db.prepare(`
      SELECT * FROM sessions WHERE id = ? AND token = ?
    `).get(decoded.sessionId, token) as Session | undefined

    if (!session) {
      return { valid: false, error: 'Session not found' }
    }

    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id)
      return { valid: false, error: 'Session expired' }
    }

    return { valid: true, userId: session.user_id }
  } catch (error) {
    return { valid: false, error: 'Invalid token' }
  }
}

/**
 * Get user by session token
 */
export function getUserByToken(token: string): User | null {
  const validation = validateSession(token)
  if (!validation.valid || !validation.userId) {
    return null
  }

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(validation.userId) as User | undefined
  return user || null
}

/**
 * Delete a session (logout)
 */
export function deleteSession(token: string): void {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { sessionId: string }
    const db = getDb()
    db.prepare('DELETE FROM sessions WHERE id = ?').run(decoded.sessionId)
  } catch {
    // Token invalid, nothing to delete
  }
}

/**
 * Delete a session (async version for Supabase)
 */
export async function deleteSessionAsync(token: string): Promise<void> {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { sessionId: string }
    const supabase = getSupabase()
    await supabase.from('sessions').delete().eq('id', decoded.sessionId)
  } catch {
    // Token invalid, nothing to delete
  }
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): number {
  const db = getDb()
  const result = db.prepare(`
    DELETE FROM sessions WHERE expires_at < datetime('now')
  `).run()
  return result.changes
}

/**
 * Get user with company info
 */
export function getUserWithCompany(userId: string): (User & { company_name?: string }) | null {
  const db = getDb()
  const user = db.prepare(`
    SELECT u.*, c.name as company_name
    FROM users u
    LEFT JOIN companies c ON u.company_id = c.id
    WHERE u.id = ?
  `).get(userId) as (User & { company_name?: string }) | undefined
  return user || null
}

/**
 * Create a password reset token
 */
export function createPasswordResetToken(userId: string): { token: string; expiresAt: string } {
  const db = getDb()
  const tokenId = uuidv4()
  const token = uuidv4() // Use a simple UUID as the reset token
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour expiry

  // Invalidate any existing tokens for this user
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(userId)

  // Create new token
  db.prepare(`
    INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenId, userId, token, expiresAt)

  return { token, expiresAt }
}

/**
 * Validate a password reset token
 */
export function validatePasswordResetToken(token: string): { valid: boolean; userId?: string; error?: string } {
  const db = getDb()

  const resetToken = db.prepare(`
    SELECT * FROM password_reset_tokens WHERE token = ?
  `).get(token) as { id: string; user_id: string; token: string; expires_at: string; used: number } | undefined

  if (!resetToken) {
    return { valid: false, error: 'Invalid or expired reset link' }
  }

  if (resetToken.used) {
    return { valid: false, error: 'This reset link has already been used' }
  }

  if (new Date(resetToken.expires_at) < new Date()) {
    return { valid: false, error: 'This reset link has expired' }
  }

  return { valid: true, userId: resetToken.user_id }
}

/**
 * Use a password reset token (mark as used)
 */
export function usePasswordResetToken(token: string): void {
  const db = getDb()
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').run(token)
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | null {
  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as User | undefined
  return user || null
}

/**
 * Update user password
 */
export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const db = getDb()
  const passwordHash = await hashPassword(newPassword)
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(passwordHash, userId)

  // Invalidate all existing sessions for this user
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
}

/**
 * Create a magic link token for portal users
 */
export function createMagicLinkToken(email: string): { token: string; expiresAt: string } {
  const db = getDb()
  const tokenId = uuidv4()
  const token = uuidv4() // Use a simple UUID as the magic link token
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minute expiry

  // Invalidate any existing tokens for this email
  db.prepare('DELETE FROM magic_link_tokens WHERE email = ?').run(email.toLowerCase())

  // Create new token
  db.prepare(`
    INSERT INTO magic_link_tokens (id, email, token, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenId, email.toLowerCase(), token, expiresAt)

  return { token, expiresAt }
}

/**
 * Validate a magic link token
 */
export function validateMagicLinkToken(token: string): { valid: boolean; email?: string; error?: string } {
  const db = getDb()

  const magicToken = db.prepare(`
    SELECT * FROM magic_link_tokens WHERE token = ?
  `).get(token) as { id: string; email: string; token: string; expires_at: string; used: number } | undefined

  if (!magicToken) {
    return { valid: false, error: 'Invalid or expired magic link' }
  }

  if (magicToken.used) {
    return { valid: false, error: 'This magic link has already been used' }
  }

  if (new Date(magicToken.expires_at) < new Date()) {
    return { valid: false, error: 'This magic link has expired' }
  }

  return { valid: true, email: magicToken.email }
}

/**
 * Use a magic link token (mark as used)
 */
export function useMagicLinkToken(token: string): void {
  const db = getDb()
  db.prepare('UPDATE magic_link_tokens SET used = 1 WHERE token = ?').run(token)
}

/**
 * Get or create a portal user by email
 * Portal users are subcontractors or brokers with limited access
 */
export function getOrCreatePortalUser(email: string, role: 'subcontractor' | 'broker' = 'subcontractor'): User {
  const db = getDb()
  const normalizedEmail = email.toLowerCase()

  // Check if user already exists
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as User | undefined

  if (!user) {
    // Create a new portal user
    const userId = uuidv4()
    const passwordHash = '$portal-user-no-password$' // Portal users don't have passwords

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, normalizedEmail, passwordHash, 'Portal User', role)

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User
  }

  return user
}

/**
 * Create a portal session for a user
 */
export function createPortalSession(userId: string): { session: Session; token: string } {
  const db = getDb()
  const sessionId = uuidv4()
  const token = jwt.sign({ sessionId, userId, isPortal: true }, getJwtSecret(), { expiresIn: '24h' })
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours for portal

  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `)
  stmt.run(sessionId, userId, token, expiresAt)

  const session: Session = {
    id: sessionId,
    user_id: userId,
    token,
    expires_at: expiresAt,
    created_at: new Date().toISOString()
  }

  return { session, token }
}
