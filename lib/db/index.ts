import Database from 'better-sqlite3'
import path from 'path'

// Database singleton
let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'riskshield.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    initializeSchema(db)
  }
  return db
}

function initializeSchema(db: Database.Database) {
  // Companies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      abn TEXT NOT NULL UNIQUE,
      acn TEXT,
      logo_url TEXT,
      address TEXT,
      primary_contact_name TEXT,
      primary_contact_email TEXT,
      primary_contact_phone TEXT,
      forwarding_email TEXT UNIQUE,
      settings TEXT DEFAULT '{}',
      subscription_tier TEXT DEFAULT 'trial',
      subscription_status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      company_id TEXT REFERENCES companies(id),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'project_administrator' CHECK(role IN ('admin', 'risk_manager', 'project_manager', 'project_administrator', 'read_only', 'subcontractor', 'broker')),
      avatar_url TEXT,
      notification_preferences TEXT DEFAULT '{}',
      invitation_status TEXT DEFAULT 'accepted' CHECK(invitation_status IN ('pending', 'accepted')),
      invitation_token TEXT,
      invitation_expires_at TEXT,
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Add invitation_status column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN invitation_status TEXT DEFAULT 'accepted' CHECK(invitation_status IN ('pending', 'accepted'))`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN invitation_token TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN invitation_expires_at TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }

  // Sessions table for authentication
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      address TEXT,
      state TEXT CHECK(state IN ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT')),
      start_date TEXT,
      end_date TEXT,
      estimated_value REAL,
      project_manager_id TEXT REFERENCES users(id),
      forwarding_email TEXT UNIQUE,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on_hold')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Insurance requirements table
  db.exec(`
    CREATE TABLE IF NOT EXISTS insurance_requirements (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      coverage_type TEXT NOT NULL CHECK(coverage_type IN ('public_liability', 'products_liability', 'workers_comp', 'professional_indemnity', 'motor_vehicle', 'contract_works')),
      minimum_limit REAL,
      limit_type TEXT DEFAULT 'per_occurrence' CHECK(limit_type IN ('per_occurrence', 'aggregate')),
      maximum_excess REAL,
      principal_indemnity_required INTEGER DEFAULT 0,
      cross_liability_required INTEGER DEFAULT 0,
      waiver_of_subrogation_required INTEGER DEFAULT 0,
      principal_naming_required TEXT DEFAULT NULL CHECK(principal_naming_required IN ('principal_named', 'interested_party', NULL)),
      other_requirements TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Add waiver_of_subrogation_required column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE insurance_requirements ADD COLUMN waiver_of_subrogation_required INTEGER DEFAULT 0`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE insurance_requirements ADD COLUMN principal_naming_required TEXT DEFAULT NULL`)
  } catch (e) {
    // Column already exists, ignore
  }

  // Subcontractors table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subcontractors (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      abn TEXT NOT NULL,
      acn TEXT,
      trading_name TEXT,
      address TEXT,
      trade TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      broker_name TEXT,
      broker_email TEXT,
      broker_phone TEXT,
      workers_comp_state TEXT,
      portal_access INTEGER DEFAULT 0,
      portal_user_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Project-Subcontractor junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_subcontractors (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      subcontractor_id TEXT NOT NULL REFERENCES subcontractors(id),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'compliant', 'non_compliant', 'exception')),
      on_site_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_id, subcontractor_id)
    )
  `)

  // COC Documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS coc_documents (
      id TEXT PRIMARY KEY,
      subcontractor_id TEXT NOT NULL REFERENCES subcontractors(id),
      project_id TEXT NOT NULL REFERENCES projects(id),
      file_url TEXT NOT NULL,
      file_name TEXT,
      file_size INTEGER,
      source TEXT DEFAULT 'upload' CHECK(source IN ('email', 'upload', 'portal', 'api')),
      source_email TEXT,
      received_at TEXT,
      processed_at TEXT,
      processing_status TEXT DEFAULT 'pending' CHECK(processing_status IN ('pending', 'processing', 'completed', 'failed')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Verifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY,
      coc_document_id TEXT NOT NULL REFERENCES coc_documents(id),
      project_id TEXT NOT NULL REFERENCES projects(id),
      status TEXT DEFAULT 'review' CHECK(status IN ('pass', 'fail', 'review')),
      confidence_score REAL,
      extracted_data TEXT DEFAULT '{}',
      checks TEXT DEFAULT '[]',
      deficiencies TEXT DEFAULT '[]',
      verified_by_user_id TEXT REFERENCES users(id),
      verified_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Communications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS communications (
      id TEXT PRIMARY KEY,
      subcontractor_id TEXT NOT NULL REFERENCES subcontractors(id),
      project_id TEXT NOT NULL REFERENCES projects(id),
      verification_id TEXT REFERENCES verifications(id),
      type TEXT NOT NULL CHECK(type IN ('deficiency', 'follow_up', 'confirmation', 'expiration_reminder', 'critical_alert')),
      channel TEXT DEFAULT 'email' CHECK(channel IN ('email', 'sms')),
      recipient_email TEXT,
      cc_emails TEXT,
      subject TEXT,
      body TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'opened', 'failed')),
      sent_at TEXT,
      delivered_at TEXT,
      opened_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Exceptions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS exceptions (
      id TEXT PRIMARY KEY,
      project_subcontractor_id TEXT NOT NULL REFERENCES project_subcontractors(id),
      verification_id TEXT REFERENCES verifications(id),
      issue_summary TEXT NOT NULL,
      reason TEXT NOT NULL,
      risk_level TEXT DEFAULT 'medium' CHECK(risk_level IN ('low', 'medium', 'high')),
      created_by_user_id TEXT NOT NULL REFERENCES users(id),
      approved_by_user_id TEXT REFERENCES users(id),
      approved_at TEXT,
      expires_at TEXT,
      expiration_type TEXT DEFAULT 'until_resolved' CHECK(expiration_type IN ('until_resolved', 'fixed_duration', 'specific_date', 'permanent')),
      status TEXT DEFAULT 'pending_approval' CHECK(status IN ('pending_approval', 'active', 'expired', 'resolved', 'closed')),
      resolved_at TEXT,
      resolution_type TEXT CHECK(resolution_type IN ('coc_updated', 'extended', 'closed', 'converted_permanent')),
      resolution_notes TEXT,
      supporting_document_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Audit logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      company_id TEXT REFERENCES companies(id),
      user_id TEXT REFERENCES users(id),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Compliance snapshots table for trend tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS compliance_snapshots (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      snapshot_date TEXT NOT NULL,
      total_subcontractors INTEGER DEFAULT 0,
      compliant INTEGER DEFAULT 0,
      non_compliant INTEGER DEFAULT 0,
      pending INTEGER DEFAULT 0,
      exception INTEGER DEFAULT 0,
      compliance_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(company_id, snapshot_date)
    )
  `)

  // Password reset tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Magic link tokens table (for portal users)
  db.exec(`
    CREATE TABLE IF NOT EXISTS magic_link_tokens (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Add invitation support columns to magic_link_tokens
  try {
    db.exec(`ALTER TABLE magic_link_tokens ADD COLUMN type TEXT DEFAULT 'magic_link'`)
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE magic_link_tokens ADD COLUMN project_id TEXT`)
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE magic_link_tokens ADD COLUMN subcontractor_id TEXT`)
  } catch (e) {
    // Column already exists
  }

  // Add invitation tracking to project_subcontractors
  try {
    db.exec(`ALTER TABLE project_subcontractors ADD COLUMN invitation_sent_at TEXT`)
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE project_subcontractors ADD COLUMN invitation_status TEXT DEFAULT 'not_sent'`)
  } catch (e) {
    // Column already exists
  }

  // Email templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      company_id TEXT REFERENCES companies(id),
      type TEXT NOT NULL CHECK(type IN ('deficiency', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'confirmation', 'expiration_reminder')),
      name TEXT,
      subject TEXT,
      body TEXT,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Requirement templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS requirement_templates (
      id TEXT PRIMARY KEY,
      company_id TEXT REFERENCES companies(id),
      name TEXT NOT NULL,
      type TEXT DEFAULT 'custom' CHECK(type IN ('commercial', 'residential', 'civil', 'fitout', 'custom')),
      requirements TEXT DEFAULT '[]',
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      company_id TEXT NOT NULL REFERENCES companies(id),
      type TEXT NOT NULL CHECK(type IN ('coc_received', 'coc_verified', 'coc_failed', 'exception_created', 'exception_approved', 'exception_expired', 'expiration_warning', 'communication_sent', 'stop_work_risk', 'system')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      entity_type TEXT,
      entity_id TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // OAuth states table (for CSRF protection during OAuth flow)
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      company_id TEXT NOT NULL REFERENCES companies(id),
      provider TEXT NOT NULL CHECK(provider IN ('microsoft', 'google')),
      state TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    )
  `)

  // OAuth connections table (stores OAuth tokens for connected accounts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_connections (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      provider TEXT NOT NULL CHECK(provider IN ('microsoft', 'google')),
      email TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_expires_at TEXT,
      last_sync_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(company_id, provider)
    )
  `)

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
    CREATE INDEX IF NOT EXISTS idx_subcontractors_company ON subcontractors(company_id);
    CREATE INDEX IF NOT EXISTS idx_coc_documents_subcontractor ON coc_documents(subcontractor_id);
    CREATE INDEX IF NOT EXISTS idx_coc_documents_project ON coc_documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_verifications_coc ON verifications(coc_document_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_token ON magic_link_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email ON magic_link_tokens(email);
    CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_type ON magic_link_tokens(type);
    CREATE INDEX IF NOT EXISTS idx_project_subcontractors_invitation ON project_subcontractors(invitation_status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
    CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
    CREATE INDEX IF NOT EXISTS idx_oauth_connections_company ON oauth_connections(company_id);
  `)
}

// Export types
export interface Company {
  id: string
  name: string
  abn: string
  acn: string | null
  logo_url: string | null
  address: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  forwarding_email: string | null
  settings: string
  subscription_tier: string
  subscription_status: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  company_id: string | null
  email: string
  password_hash: string
  name: string
  phone: string | null
  role: 'admin' | 'risk_manager' | 'project_manager' | 'project_administrator' | 'read_only' | 'subcontractor' | 'broker'
  avatar_url: string | null
  notification_preferences: string
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  user_id: string
  token: string
  expires_at: string
  created_at: string
}

export interface Project {
  id: string
  company_id: string
  name: string
  address: string | null
  state: 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'NT' | 'ACT' | null
  start_date: string | null
  end_date: string | null
  estimated_value: number | null
  project_manager_id: string | null
  forwarding_email: string | null
  status: 'active' | 'completed' | 'on_hold'
  created_at: string
  updated_at: string
}

export interface Subcontractor {
  id: string
  company_id: string
  name: string
  abn: string
  acn: string | null
  trading_name: string | null
  address: string | null
  trade: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  broker_name: string | null
  broker_email: string | null
  broker_phone: string | null
  workers_comp_state: string | null
  portal_access: number
  portal_user_id: string | null
  created_at: string
  updated_at: string
}
