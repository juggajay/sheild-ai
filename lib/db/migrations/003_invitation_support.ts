import { Migration } from './index'

/**
 * Add invitation support for subcontractor portal
 * - Extend magic_link_tokens with type, project_id, subcontractor_id
 * - Add invitation tracking to project_subcontractors
 */
export const migration: Migration = {
  version: 3,
  name: 'invitation_support',
  up: (db) => {
    // Add type column to magic_link_tokens (magic_link vs invitation)
    try {
      db.exec(`ALTER TABLE magic_link_tokens ADD COLUMN type TEXT DEFAULT 'magic_link' CHECK(type IN ('magic_link', 'invitation'))`)
    } catch (e) {
      // Column already exists
    }

    // Add project_id for invitation context
    try {
      db.exec(`ALTER TABLE magic_link_tokens ADD COLUMN project_id TEXT REFERENCES projects(id)`)
    } catch (e) {
      // Column already exists
    }

    // Add subcontractor_id for invitation context
    try {
      db.exec(`ALTER TABLE magic_link_tokens ADD COLUMN subcontractor_id TEXT REFERENCES subcontractors(id)`)
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
      db.exec(`ALTER TABLE project_subcontractors ADD COLUMN invitation_status TEXT DEFAULT 'not_sent' CHECK(invitation_status IN ('not_sent', 'sent', 'opened', 'completed'))`)
    } catch (e) {
      // Column already exists
    }

    // Add indexes for new columns
    db.exec('CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_type ON magic_link_tokens(type)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_project ON magic_link_tokens(project_id)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_project_subcontractors_invitation ON project_subcontractors(invitation_status)')
  },
  down: (db) => {
    // SQLite doesn't support DROP COLUMN easily, so we just drop indexes
    db.exec('DROP INDEX IF EXISTS idx_magic_link_tokens_type')
    db.exec('DROP INDEX IF EXISTS idx_magic_link_tokens_project')
    db.exec('DROP INDEX IF EXISTS idx_project_subcontractors_invitation')
  }
}
