import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Types
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
  settings: Record<string, unknown>
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
  notification_preferences: Record<string, unknown>
  invitation_status: string | null
  invitation_token: string | null
  invitation_expires_at: string | null
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
  portal_access: boolean
  portal_user_id: string | null
  created_at: string
  updated_at: string
}

// Supabase client singleton
let supabaseClient: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey)
  }
  return supabaseClient
}

// Helper function to check if we should use Supabase
export function useSupabase(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// ============================================
// User Operations
// ============================================

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function createUser(user: Partial<User>): Promise<User> {
  const { data, error } = await getSupabase()
    .from('users')
    .insert({
      ...user,
      email: user.email?.toLowerCase(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  const { data, error } = await getSupabase()
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// Session Operations
// ============================================

export async function getSessionByToken(token: string): Promise<Session | null> {
  const { data, error } = await getSupabase()
    .from('sessions')
    .select('*')
    .eq('token', token)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function createSession(session: Partial<Session>): Promise<Session> {
  const { data, error } = await getSupabase()
    .from('sessions')
    .insert({
      ...session,
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSession(token: string): Promise<void> {
  const { error } = await getSupabase()
    .from('sessions')
    .delete()
    .eq('token', token)

  if (error) throw error
}

export async function deleteExpiredSessions(): Promise<void> {
  const { error } = await getSupabase()
    .from('sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())

  if (error) throw error
}

// ============================================
// Company Operations
// ============================================

export async function getCompanyById(id: string): Promise<Company | null> {
  const { data, error } = await getSupabase()
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function createCompany(company: Partial<Company>): Promise<Company> {
  const { data, error } = await getSupabase()
    .from('companies')
    .insert({
      ...company,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// Project Operations
// ============================================

export async function getProjectById(id: string): Promise<Project | null> {
  const { data, error } = await getSupabase()
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function getProjectsByCompany(companyId: string): Promise<Project[]> {
  const { data, error } = await getSupabase()
    .from('projects')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createProject(project: Partial<Project>): Promise<Project> {
  const { data, error } = await getSupabase()
    .from('projects')
    .insert({
      ...project,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const { data, error } = await getSupabase()
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ============================================
// Subcontractor Operations
// ============================================

export async function getSubcontractorById(id: string): Promise<Subcontractor | null> {
  const { data, error } = await getSupabase()
    .from('subcontractors')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function getSubcontractorsByCompany(companyId: string): Promise<Subcontractor[]> {
  const { data, error } = await getSupabase()
    .from('subcontractors')
    .select('*')
    .eq('company_id', companyId)
    .order('name')

  if (error) throw error
  return data || []
}

export async function createSubcontractor(sub: Partial<Subcontractor>): Promise<Subcontractor> {
  const { data, error } = await getSupabase()
    .from('subcontractors')
    .insert({
      ...sub,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSubcontractor(id: string, updates: Partial<Subcontractor>): Promise<Subcontractor> {
  const { data, error } = await getSupabase()
    .from('subcontractors')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// Generic Query Helper (for complex queries)
// ============================================

export async function query<T>(
  table: string,
  options?: {
    select?: string
    filters?: Record<string, unknown>
    order?: { column: string; ascending?: boolean }
    limit?: number
    single?: boolean
  }
): Promise<T | T[] | null> {
  let q = getSupabase().from(table).select(options?.select || '*')

  if (options?.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      q = q.eq(key, value)
    }
  }

  if (options?.order) {
    q = q.order(options.order.column, { ascending: options.order.ascending ?? true })
  }

  if (options?.limit) {
    q = q.limit(options.limit)
  }

  if (options?.single) {
    const { data, error } = await q.single()
    if (error && error.code !== 'PGRST116') throw error
    return data as T | null
  }

  const { data, error } = await q
  if (error) throw error
  return data as T[]
}

export async function insert<T>(table: string, data: Partial<T>): Promise<T> {
  const { data: result, error } = await getSupabase()
    .from(table)
    .insert({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return result as T
}

export async function update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
  const { data: result, error } = await getSupabase()
    .from(table)
    .update({
      ...data,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return result as T
}

export async function remove(table: string, id: string): Promise<void> {
  const { error } = await getSupabase()
    .from(table)
    .delete()
    .eq('id', id)

  if (error) throw error
}
