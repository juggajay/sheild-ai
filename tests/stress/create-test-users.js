/**
 * Create Test Users for Stress Testing
 *
 * This script creates multiple test users to enable realistic load testing
 * without hitting rate limits on a single account.
 *
 * Usage: node create-test-users.js
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Test user configuration
const TEST_USERS = [
  { email: 'admin@test.com', name: 'Test Admin', role: 'admin' },
  { email: 'user1@test.com', name: 'Test User 1', role: 'risk_manager' },
  { email: 'user2@test.com', name: 'Test User 2', role: 'project_manager' },
  { email: 'user3@test.com', name: 'Test User 3', role: 'project_manager' },
  { email: 'user4@test.com', name: 'Test User 4', role: 'project_administrator' },
  { email: 'user5@test.com', name: 'Test User 5', role: 'project_administrator' },
  { email: 'user6@test.com', name: 'Test User 6', role: 'read_only' },
  { email: 'user7@test.com', name: 'Test User 7', role: 'read_only' },
  { email: 'user8@test.com', name: 'Test User 8', role: 'project_manager' },
  { email: 'user9@test.com', name: 'Test User 9', role: 'project_manager' },
  { email: 'user10@test.com', name: 'Test User 10', role: 'risk_manager' },
  { email: 'user11@test.com', name: 'Test User 11', role: 'project_manager' },
  { email: 'user12@test.com', name: 'Test User 12', role: 'project_manager' },
  { email: 'user13@test.com', name: 'Test User 13', role: 'project_administrator' },
  { email: 'user14@test.com', name: 'Test User 14', role: 'project_administrator' },
  { email: 'user15@test.com', name: 'Test User 15', role: 'read_only' },
  { email: 'user16@test.com', name: 'Test User 16', role: 'project_manager' },
  { email: 'user17@test.com', name: 'Test User 17', role: 'project_manager' },
  { email: 'user18@test.com', name: 'Test User 18', role: 'project_manager' },
  { email: 'user19@test.com', name: 'Test User 19', role: 'project_manager' },
];

const TEST_PASSWORD = 'TestPassword123!';

async function createTestUsers() {
  console.log('Creating test users for stress testing...\n');

  try {
    const Database = require('better-sqlite3');
    const db = new Database('./riskshield.db');

    // Get or create test company
    let company = db.prepare('SELECT id FROM companies WHERE name LIKE ?').get('%Test%');

    if (!company) {
      const companyId = uuidv4();
      db.prepare(`
        INSERT INTO companies (id, name, created_at, updated_at)
        VALUES (?, 'Stress Test Company', datetime('now'), datetime('now'))
      `).run(companyId);
      company = { id: companyId };
      console.log(`Created test company: ${companyId}`);
    }

    const companyId = company.id;
    const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 12);

    // Create users
    let created = 0;
    let skipped = 0;

    for (const user of TEST_USERS) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(user.email);

      if (existing) {
        console.log(`  [SKIP] ${user.email} (already exists)`);
        skipped++;
        continue;
      }

      const userId = uuidv4();
      db.prepare(`
        INSERT INTO users (id, company_id, email, password_hash, name, role, invitation_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'accepted', datetime('now'), datetime('now'))
      `).run(userId, companyId, user.email, passwordHash, user.name, user.role);

      console.log(`  [CREATE] ${user.email} (${user.role})`);
      created++;
    }

    console.log(`\n✅ Complete: ${created} created, ${skipped} skipped`);
    console.log(`\nAll users have password: ${TEST_PASSWORD}`);

    // Output user list for k6 config
    console.log('\n--- k6 User Pool Configuration ---');
    console.log('Copy this to your k6 config:\n');
    console.log('export const TEST_USERS = [');
    for (const user of TEST_USERS) {
      console.log(`  { email: '${user.email}', password: '${TEST_PASSWORD}' },`);
    }
    console.log('];');

    db.close();

  } catch (error) {
    console.error('Error creating test users:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  createTestUsers();
}

module.exports = { TEST_USERS, TEST_PASSWORD, createTestUsers };
