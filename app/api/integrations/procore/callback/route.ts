import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import {
  getProcoreConfig,
  isProcoreDevMode,
  MOCK_PROCORE_COMPANIES,
  createMockOAuthTokens,
} from '@/lib/procore'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

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

    // Verify state token using Convex
    console.log(`[Procore] Callback received - state: ${state?.substring(0, 8)}...`)
    console.log(`[Procore] Looking up state in Convex...`)

    const stateRecord = await convex.query(api.integrations.getOAuthState, { state })

    if (!stateRecord) {
      console.log('[Procore] State not found or expired')
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=invalid_state', request.url)
      )
    }

    console.log(`[Procore] State found! company_id: ${stateRecord.companyId}`)

    // Delete used state
    await convex.mutation(api.integrations.deleteOAuthState, { state })

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
      console.log(`[Procore] Companies response:`, JSON.stringify(companies))
    }

    // Check if we got any companies
    if (!companies || companies.length === 0) {
      console.error('[Procore] No companies returned from Procore API')
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=no_companies&details=No%20Procore%20companies%20found%20for%20this%20account', request.url)
      )
    }

    console.log(`[Procore] Found ${companies.length} companies`)

    // Store tokens (with pending company selection if multiple companies)
    const hasMultipleCompanies = companies.length > 1
    const tokenExpiresAt = Date.now() + (tokens.expires_in || 7200) * 1000

    if (hasMultipleCompanies) {
      // Store tokens with pending_company_selection flag
      console.log(`[Procore] Storing connection with pending company selection...`)
      try {
        await convex.mutation(api.integrations.upsertConnection, {
          companyId: stateRecord.companyId as Id<"companies">,
          provider: 'procore',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: tokenExpiresAt,
          pendingCompanySelection: true,
        })
      } catch (err) {
        console.error('[Procore] Failed to store connection:', err)
        return NextResponse.redirect(
          new URL(`/dashboard/settings/integrations?error=db_error`, request.url)
        )
      }

      console.log(`[Procore] OAuth tokens stored for company ${stateRecord.companyId}, pending company selection`)

      // Redirect to company selection
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?action=procore_select_company', request.url)
      )
    } else {
      // Single company - complete connection
      const procoreCompany = companies[0]
      console.log(`[Procore] Single company found: ${procoreCompany.name} (ID: ${procoreCompany.id})`)

      console.log(`[Procore] Storing connection for company ${procoreCompany.name}...`)
      try {
        await convex.mutation(api.integrations.upsertConnection, {
          companyId: stateRecord.companyId as Id<"companies">,
          provider: 'procore',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: tokenExpiresAt,
          procoreCompanyId: procoreCompany.id,
          procoreCompanyName: procoreCompany.name,
          pendingCompanySelection: false,
        })
      } catch (err) {
        console.error('[Procore] Failed to store connection:', err)
        return NextResponse.redirect(
          new URL(`/dashboard/settings/integrations?error=db_error`, request.url)
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
