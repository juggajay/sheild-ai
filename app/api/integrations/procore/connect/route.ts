import { NextRequest, NextResponse } from 'next/server'
import { getUserByToken, getUserByTokenAsync } from '@/lib/auth'
import { getDb, isProduction, getSupabase } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import {
  getProcoreConfig,
  isProcoreDevMode,
  buildProcoreAuthUrl,
} from '@/lib/procore'

/**
 * GET /api/integrations/procore/connect
 *
 * Initiates the Procore OAuth flow.
 * In dev mode, simulates the flow with mock data.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user - use async version for production (Supabase), sync for dev (SQLite)
    const user = isProduction
      ? await getUserByTokenAsync(token)
      : getUserByToken(token)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can manage integrations
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const config = getProcoreConfig()
    const isDevMode = isProcoreDevMode()

    // Generate state token for CSRF protection
    const state = uuidv4()
    const stateId = uuidv4()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Store state in database for verification
    if (isProduction) {
      const supabase = getSupabase()
      await supabase.from('oauth_states').insert({
        id: stateId,
        user_id: user.id,
        company_id: user.company_id,
        provider: 'procore',
        state,
        created_at: new Date().toISOString(),
        expires_at: expiresAt
      })
    } else {
      const db = getDb()
      db.prepare(`
        INSERT INTO oauth_states (id, user_id, company_id, provider, state, created_at, expires_at)
        VALUES (?, ?, ?, 'procore', ?, datetime('now'), datetime('now', '+10 minutes'))
      `).run(stateId, user.id, user.company_id, state)
    }

    // Dev mode simulation - redirect directly to callback
    if (isDevMode) {
      console.log('[Procore DEV] Simulating OAuth connection flow')

      const devCallbackUrl = new URL('/api/integrations/procore/callback', request.url)
      devCallbackUrl.searchParams.set('state', state)
      devCallbackUrl.searchParams.set('code', 'dev_mode_simulated_code')
      devCallbackUrl.searchParams.set('dev', 'true')

      return NextResponse.redirect(devCallbackUrl)
    }

    // Production: Redirect to Procore authorization URL
    const authUrl = buildProcoreAuthUrl(state)
    console.log(`[Procore] Redirecting to OAuth authorization for company ${user.company_id}`)

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Procore OAuth connect error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Procore connection' },
      { status: 500 }
    )
  }
}
