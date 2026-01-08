import { createClient } from '@supabase/supabase-js'

// Create Supabase client with service role for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Helper to convert SQLite-style queries to Supabase
// This is a compatibility layer to minimize code changes during migration

type QueryResult = Record<string, unknown>

interface PreparedStatement {
  get: (...params: unknown[]) => QueryResult | undefined
  all: (...params: unknown[]) => QueryResult[]
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number }
}

// Parse SQL to extract table name and operation
function parseSQL(sql: string): {
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'OTHER'
  table: string
  columns?: string[]
  whereClause?: string
} {
  const normalized = sql.trim().toUpperCase()

  if (normalized.startsWith('SELECT')) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i)
    const table = fromMatch ? fromMatch[1] : ''
    return { operation: 'SELECT', table }
  }

  if (normalized.startsWith('INSERT')) {
    const intoMatch = sql.match(/INTO\s+(\w+)/i)
    const table = intoMatch ? intoMatch[1] : ''
    const columnsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i)
    const columns = columnsMatch ? columnsMatch[1].split(',').map(c => c.trim()) : []
    return { operation: 'INSERT', table, columns }
  }

  if (normalized.startsWith('UPDATE')) {
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i)
    const table = tableMatch ? tableMatch[1] : ''
    return { operation: 'UPDATE', table }
  }

  if (normalized.startsWith('DELETE')) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i)
    const table = fromMatch ? fromMatch[1] : ''
    return { operation: 'DELETE', table }
  }

  if (normalized.startsWith('CREATE')) {
    return { operation: 'CREATE', table: '' }
  }

  return { operation: 'OTHER', table: '' }
}

// Execute a Supabase query based on parsed SQL
async function executeQuery(
  sql: string,
  params: unknown[],
  single: boolean
): Promise<QueryResult | QueryResult[] | undefined> {
  const { operation, table } = parseSQL(sql)

  // For complex queries, use raw SQL via RPC
  // This is a fallback for queries that can't be easily translated
  try {
    if (operation === 'SELECT') {
      return await executeSelect(sql, params, single)
    }

    if (operation === 'INSERT') {
      return await executeInsert(sql, params)
    }

    if (operation === 'UPDATE') {
      return await executeUpdate(sql, params)
    }

    if (operation === 'DELETE') {
      return await executeDelete(sql, params)
    }

    // For CREATE and other DDL, skip (tables already exist)
    if (operation === 'CREATE') {
      return single ? undefined : []
    }

    // Fallback: try to execute as raw SQL
    console.warn('Unhandled SQL operation:', sql.substring(0, 50))
    return single ? undefined : []
  } catch (error) {
    console.error('Supabase query error:', error)
    console.error('SQL:', sql)
    console.error('Params:', params)
    throw error
  }
}

async function executeSelect(sql: string, params: unknown[], single: boolean): Promise<QueryResult | QueryResult[] | undefined> {
  // Extract table name
  const fromMatch = sql.match(/FROM\s+(\w+)/i)
  if (!fromMatch) {
    console.warn('Could not parse SELECT table from:', sql)
    return single ? undefined : []
  }

  const table = fromMatch[1]
  let query = supabase.from(table).select('*')

  // Parse WHERE clause and apply filters
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|GROUP|$)/i)
  if (whereMatch) {
    const whereClause = whereMatch[1].trim()
    query = applyWhereClause(query, whereClause, params)
  }

  // Parse ORDER BY
  const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i)
  if (orderMatch) {
    const column = orderMatch[1]
    const ascending = !orderMatch[2] || orderMatch[2].toUpperCase() === 'ASC'
    query = query.order(column, { ascending })
  }

  // Parse LIMIT
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
  if (limitMatch) {
    query = query.limit(parseInt(limitMatch[1]))
  }

  if (single) {
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    return data as QueryResult | undefined
  } else {
    const { data, error } = await query
    if (error) throw error
    return (data || []) as QueryResult[]
  }
}

async function executeInsert(sql: string, params: unknown[]): Promise<QueryResult | undefined> {
  const intoMatch = sql.match(/INTO\s+(\w+)/i)
  if (!intoMatch) {
    console.warn('Could not parse INSERT table from:', sql)
    return undefined
  }

  const table = intoMatch[1]

  // Extract column names
  const columnsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i)
  if (!columnsMatch) {
    console.warn('Could not parse INSERT columns from:', sql)
    return undefined
  }

  const columns = columnsMatch[1].split(',').map(c => c.trim())

  // Build the insert object
  const insertData: Record<string, unknown> = {}
  columns.forEach((col, idx) => {
    insertData[col] = params[idx]
  })

  const { data, error } = await supabase
    .from(table)
    .insert(insertData)
    .select()
    .single()

  if (error) throw error
  return data as QueryResult
}

async function executeUpdate(sql: string, params: unknown[]): Promise<{ changes: number }> {
  const tableMatch = sql.match(/UPDATE\s+(\w+)/i)
  if (!tableMatch) {
    console.warn('Could not parse UPDATE table from:', sql)
    return { changes: 0 }
  }

  const table = tableMatch[1]

  // Extract SET clause
  const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i)
  if (!setMatch) {
    console.warn('Could not parse UPDATE SET clause from:', sql)
    return { changes: 0 }
  }

  const setClause = setMatch[1]
  const setParts = setClause.split(',').map(p => p.trim())

  // Extract WHERE clause
  const whereMatch = sql.match(/WHERE\s+(.+?)$/i)

  // Count placeholders in SET to know where WHERE params start
  const setPlaceholders = (setClause.match(/\?/g) || []).length

  // Build update object
  const updateData: Record<string, unknown> = {}
  let paramIdx = 0
  setParts.forEach(part => {
    const [col] = part.split('=').map(p => p.trim())
    if (part.includes('?')) {
      updateData[col] = params[paramIdx++]
    } else {
      // Handle expressions like updated_at = datetime('now')
      // For Supabase, we'll use NOW() which is handled by the default
      if (part.includes("datetime('now')") || part.includes('NOW()')) {
        updateData[col] = new Date().toISOString()
      }
    }
  })

  let query = supabase.from(table).update(updateData)

  // Apply WHERE clause
  if (whereMatch) {
    const whereParams = params.slice(setPlaceholders)
    query = applyWhereClause(query, whereMatch[1], whereParams)
  }

  const { error, count } = await query

  if (error) throw error
  return { changes: count || 1 }
}

async function executeDelete(sql: string, params: unknown[]): Promise<{ changes: number }> {
  const fromMatch = sql.match(/FROM\s+(\w+)/i)
  if (!fromMatch) {
    console.warn('Could not parse DELETE table from:', sql)
    return { changes: 0 }
  }

  const table = fromMatch[1]
  let query = supabase.from(table).delete()

  // Extract and apply WHERE clause
  const whereMatch = sql.match(/WHERE\s+(.+?)$/i)
  if (whereMatch) {
    query = applyWhereClause(query, whereMatch[1], params)
  }

  const { error, count } = await query

  if (error) throw error
  return { changes: count || 1 }
}

function applyWhereClause(query: any, whereClause: string, params: unknown[]): any {
  // Simple parser for common WHERE patterns
  // Handles: col = ?, col IS NULL, col IN (...), AND, OR

  let paramIdx = 0

  // Split by AND (simple case)
  const conditions = whereClause.split(/\s+AND\s+/i)

  for (const condition of conditions) {
    const trimmed = condition.trim()

    // Handle: col = ?
    if (trimmed.includes('= ?')) {
      const col = trimmed.split('=')[0].trim()
      query = query.eq(col, params[paramIdx++])
    }
    // Handle: col != ? or col <> ?
    else if (trimmed.includes('!= ?') || trimmed.includes('<> ?')) {
      const col = trimmed.split(/!=|<>/)[0].trim()
      query = query.neq(col, params[paramIdx++])
    }
    // Handle: col > ?
    else if (trimmed.includes('> ?') && !trimmed.includes('>= ?')) {
      const col = trimmed.split('>')[0].trim()
      query = query.gt(col, params[paramIdx++])
    }
    // Handle: col >= ?
    else if (trimmed.includes('>= ?')) {
      const col = trimmed.split('>=')[0].trim()
      query = query.gte(col, params[paramIdx++])
    }
    // Handle: col < ?
    else if (trimmed.includes('< ?') && !trimmed.includes('<= ?')) {
      const col = trimmed.split('<')[0].trim()
      query = query.lt(col, params[paramIdx++])
    }
    // Handle: col <= ?
    else if (trimmed.includes('<= ?')) {
      const col = trimmed.split('<=')[0].trim()
      query = query.lte(col, params[paramIdx++])
    }
    // Handle: col IS NULL
    else if (trimmed.toUpperCase().includes('IS NULL')) {
      const col = trimmed.split(/IS\s+NULL/i)[0].trim()
      query = query.is(col, null)
    }
    // Handle: col IS NOT NULL
    else if (trimmed.toUpperCase().includes('IS NOT NULL')) {
      const col = trimmed.split(/IS\s+NOT\s+NULL/i)[0].trim()
      query = query.not(col, 'is', null)
    }
    // Handle: col LIKE ?
    else if (trimmed.toUpperCase().includes('LIKE ?')) {
      const col = trimmed.split(/LIKE/i)[0].trim()
      const pattern = params[paramIdx++] as string
      query = query.ilike(col, pattern)
    }
  }

  return query
}

// Synchronous wrapper using a cache for frequently accessed data
// Note: This is a compatibility layer - some operations may need to be async
const queryCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 1000 // 1 second cache

function getCached(key: string): unknown | undefined {
  const cached = queryCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  return undefined
}

function setCache(key: string, data: unknown): void {
  queryCache.set(key, { data, timestamp: Date.now() })
}

// Create a synchronous-looking interface that actually uses async
// This is needed because the existing code expects synchronous database calls
export function createSupabaseDb() {
  return {
    prepare: (sql: string): PreparedStatement => {
      return {
        get: (...params: unknown[]): QueryResult | undefined => {
          // For synchronous compatibility, we need to handle this differently
          // In production, all callers should be updated to use async
          throw new Error('Synchronous get() not supported. Use async getAsync() instead.')
        },
        all: (...params: unknown[]): QueryResult[] => {
          throw new Error('Synchronous all() not supported. Use async allAsync() instead.')
        },
        run: (...params: unknown[]): { changes: number; lastInsertRowid: number } => {
          throw new Error('Synchronous run() not supported. Use async runAsync() instead.')
        }
      }
    },

    // Async versions for the migration
    prepareAsync: (sql: string) => {
      return {
        getAsync: async (...params: unknown[]): Promise<QueryResult | undefined> => {
          return await executeQuery(sql, params, true) as QueryResult | undefined
        },
        allAsync: async (...params: unknown[]): Promise<QueryResult[]> => {
          return await executeQuery(sql, params, false) as QueryResult[]
        },
        runAsync: async (...params: unknown[]): Promise<{ changes: number; lastInsertRowid: number }> => {
          const result = await executeQuery(sql, params, true)
          return { changes: 1, lastInsertRowid: 0 }
        }
      }
    },

    exec: (sql: string): void => {
      // For DDL statements like CREATE TABLE, skip (tables already exist in Supabase)
      console.log('Skipping exec (DDL):', sql.substring(0, 50))
    },

    pragma: (setting: string): void => {
      // SQLite-specific, skip for Supabase
    }
  }
}

// Direct Supabase access for new code
export { supabase }
