import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import {
  getProcoreConfig,
  isProcoreDevMode,
  buildProcoreAuthUrl,
} from '@/lib/procore'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

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

    const user = getUserByToken(token)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can manage integrations
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 400 })
    }

    const config = getProcoreConfig()
    const isDevMode = isProcoreDevMode()

    // Generate state token for CSRF protection
    const state = uuidv4()

    // Store state in Convex for verification
    console.log(`[Procore] Storing OAuth state in Convex: ${state.substring(0, 8)}...`)
    try {
      await convex.mutation(api.integrations.createOAuthState, {
        userId: user.id as Id<"users">,
        companyId: user.company_id as Id<"companies">,
        provider: 'procore',
        state,
      })
      console.log(`[Procore] OAuth state stored successfully`)
    } catch (error) {
      console.error('[Procore] Failed to store OAuth state:', error)
      return NextResponse.json(
        { error: 'Failed to initiate OAuth flow' },
        { status: 500 }
      )
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
