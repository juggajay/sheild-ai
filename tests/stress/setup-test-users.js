/**
 * Setup Test Users
 * Run this script to create test users for stress testing
 *
 * Usage: node setup-test-users.js
 */

const bcrypt = require('bcryptjs');

// Test user configuration
const TEST_USERS = [
  {
    email: 'admin@test.com',
    password: 'TestPassword123!',
    name: 'Test Admin',
    role: 'admin',
  },
  {
    email: 'user@test.com',
    password: 'TestPassword123!',
    name: 'Test User',
    role: 'project_manager',
  },
  {
    email: 'readonly@test.com',
    password: 'TestPassword123!',
    name: 'Read Only User',
    role: 'read_only',
  },
];

async function setupTestUsers() {
  console.log('Setting up test users for stress testing...\n');

  for (const user of TEST_USERS) {
    const hashedPassword = await bcrypt.hash(user.password, 12);
    console.log(`User: ${user.email}`);
    console.log(`  Password: ${user.password}`);
    console.log(`  Hashed: ${hashedPassword}`);
    console.log(`  Role: ${user.role}`);
    console.log('');
  }

  console.log('SQL to insert test users (adjust table/company_id as needed):');
  console.log('='.repeat(60));
  console.log('');

  for (const user of TEST_USERS) {
    const hashedPassword = await bcrypt.hash(user.password, 12);
    console.log(`INSERT INTO users (email, password_hash, name, role, company_id, created_at, updated_at)`);
    console.log(`VALUES ('${user.email}', '${hashedPassword}', '${user.name}', '${user.role}', 1, datetime('now'), datetime('now'));`);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('\nAlternatively, use the signup API to create users,');
  console.log('or add them through your application\'s admin interface.');
}

// Run if executed directly
if (require.main === module) {
  setupTestUsers().catch(console.error);
}

module.exports = { TEST_USERS, setupTestUsers };
