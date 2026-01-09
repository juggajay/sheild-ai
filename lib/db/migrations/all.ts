/**
 * Central registry of all migrations
 * Import and export all migrations here for use by runner scripts
 */

import { Migration } from './index'
import { migration as migration001 } from './001_initial_schema'
import { migration as migration002 } from './002_add_indexes'
import { migration as migration003 } from './003_invitation_support'
import { migration as migration004 } from './004_stripe_billing'
import { migration as migration005 } from './005_procore_integration'

// Export all migrations in order
export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
]
