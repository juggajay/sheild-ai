import { NextRequest, NextResponse } from 'next/server'
import { getDb, isProduction, getSupabase } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import {
  getProcoreConfig,
  isProcoreDevMode,
  MOCK_PROCORE_COMPANIES,
  createMockOAuthTokens,
} from '@/lib/procore'

interface OAuthStateRecord {
  id: string
  user_id: string
  company_id: string
  provider: string
  state: string
  created_at: string
  expires_at: string
}

interface ProcoreTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  created_at: number
}

interface ProcoreCompanyResponse {
  id: number
  name: string
  is_active: boolean
}

/**
 * GET /api/integrations/procore/callback
 *
 * Handles the OAuth callback from Procore.
 * Exchanges the authorization code for tokens and fetches available companies.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const isDev = searchParams.get('dev') === 'true'

    // Handle OAuth errors
    if (error) {
      console.error('Procore OAuth error:', error)
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=oauth_denied', request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=invalid_callback', request.url)
      )
    }

    // Verify state token
    let stateRecord: OAuthStateRecord | undefined

    if (isProduction) {
      const supabase = getSupabase()
      const { data, error: queryError } = await supabase
        .from('oauth_states')
        .select('*')
        .eq('state', state)
        .eq('provider', 'procore')
        .gt('expires_at', new Date().toISOString())
        .single()

      if (queryError) {
        console.error('[Procore] State lookup error:', queryError)
      }

      if (data) {
        stateRecord = data as OAuthStateRecord
      }

      // Delete used state
      if (stateRecord) {
        await supabase.from('oauth_states').delete().eq('state', state)
      }
    } else {
      const db = getDb()
      stateRecord = db.prepare(`
        SELECT os.*, u.company_id
        FROM oauth_states os
        JOIN users u ON os.user_id = u.id
        WHERE os.state = ? AND os.provider = 'procore' AND os.expires_at > datetime('now')
      `).get(state) as OAuthStateRecord | undefined

      // Delete used state
      if (stateRecord) {
        db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state)
      }
    }

    if (!stateRecord) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=invalid_state', request.url)
      )
    }

    const config = getProcoreConfig()
    const isDevMode = isProcoreDevMode()

    let tokens: ProcoreTokenResponse
    let companies: ProcoreCompanyResponse[]

    // Dev mode simulation
    if (isDevMode || isDev) {
      console.log('[Procore DEV] Simulating OAuth callback')

      const mockTokens = createMockOAuthTokens()
      tokens = {
        access_token: mockTokens.access_token,
        refresh_token: mockTokens.refresh_token,
        token_type: mockTokens.token_type,
        expires_in: mockTokens.expires_in,
        created_at: mockTokens.created_at,
      }

      companies = MOCK_PROCORE_COMPANIES.map(c => ({
        id: c.id,
        name: c.name,
        is_active: c.is_active,
      }))

      console.log(`[Procore DEV] Mock companies available: ${companies.length}`)
    } else {
      // Production: Exchange code for tokens
      const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
        }),
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('Procore token exchange failed:', errorText)
        return NextResponse.redirect(
          new URL('/dashboard/settings/integrations?error=token_exchange_failed', request.url)
        )
      }

      tokens = await tokenResponse.json()

      // Fetch available companies
      const companiesResponse = await fetch(`${config.apiBaseUrl}/rest/v1.0/companies`, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      })

      if (!companiesResponse.ok) {
        console.error('Failed to fetch Procore companies')
        return NextResponse.redirect(
          new URL('/dashboard/settings/integrations?error=companies_failed', request.url)
        )
      }

      companies = await companiesResponse.json()
    }

    // Store tokens (with pending company selection if multiple companies)
    const connectionId = uuidv4()
    const hasMultipleCompanies = companies.length > 1
    const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 7200) * 1000).toISOString()
    const now = new Date().toISOString()

    if (hasMultipleCompanies) {
      // Store tokens with pending_company_selection flag
      if (isProduction) {
        const supabase = getSupabase()
        await supabase.from('oauth_connections').upsert({
          id: connectionId,
          company_id: stateRecord.company_id,
          provider: 'procore',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
          pending_company_selection: true,
          created_at: now,
          updated_at: now
        }, { onConflict: 'company_id,provider' })
      } else {
        const db = getDb()
        db.prepare(`
          INSERT INTO oauth_connections (
            id, company_id, provider, access_token, refresh_token,
            token_expires_at, pending_company_selection, created_at, updated_at
          )
          VALUES (?, ?, 'procore', ?, ?, datetime('now', '+' || ? || ' seconds'), 1, datetime('now'), datetime('now'))
          ON CONFLICT(company_id, provider) DO UPDATE SET
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            token_expires_at = excluded.token_expires_at,
            pending_company_selection = 1,
            updated_at = datetime('now')
        `).run(
          connectionId,
          stateRecord.company_id,
          tokens.access_token,
          tokens.refresh_token,
          tokens.expires_in || 7200
        )
      }

      console.log(`[Procore] OAuth tokens stored for company ${stateRecord.company_id}, pending company selection`)

      // Redirect to company selection
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?action=procore_select_company', request.url)
      )
    } else {
      // Single company - complete connection
      const procoreCompany = companies[0]

      if (isProduction) {
        const supabase = getSupabase()
        await supabase.from('oauth_connections').upsert({
          id: connectionId,
          company_id: stateRecord.company_id,
          provider: 'procore',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
          procore_company_id: procoreCompany.id,
          procore_company_name: procoreCompany.name,
          pending_company_selection: false,
          created_at: now,
          updated_at: now
        }, { onConflict: 'company_id,provider' })
      } else {
        const db = getDb()
        db.prepare(`
          INSERT INTO oauth_connections (
            id, company_id, provider, access_token, refresh_token,
            token_expires_at, procore_company_id, procore_company_name,
            pending_company_selection, created_at, updated_at
          )
          VALUES (?, ?, 'procore', ?, ?, datetime('now', '+' || ? || ' seconds'), ?, ?, 0, datetime('now'), datetime('now'))
          ON CONFLICT(company_id, provider) DO UPDATE SET
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            token_expires_at = excluded.token_expires_at,
            procore_company_id = excluded.procore_company_id,
            procore_company_name = excluded.procore_company_name,
            pending_company_selection = 0,
            updated_at = datetime('now')
        `).run(
          connectionId,
          stateRecord.company_id,
          tokens.access_token,
          tokens.refresh_token,
          tokens.expires_in || 7200,
          procoreCompany.id,
          procoreCompany.name
        )
      }

      console.log(`[Procore] Connected to company "${procoreCompany.name}" (ID: ${procoreCompany.id})`)

      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?success=procore_connected', request.url)
      )
    }
  } catch (error) {
    console.error('Procore OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/settings/integrations?error=callback_failed', request.url)
    )
  }
}
