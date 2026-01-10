import { NextRequest, NextResponse } from "next/server"
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { v4 as uuidv4 } from "uuid"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google/callback`

// Dev mode check
const isDevMode = !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'test' || GOOGLE_CLIENT_ID.startsWith('test_')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const isDev = searchParams.get('dev') === 'true'

    // Handle OAuth errors
    if (error) {
      console.error("Google OAuth error:", error)
      return NextResponse.redirect(new URL('/dashboard/settings/integrations?error=oauth_denied', request.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/dashboard/settings/integrations?error=invalid_callback', request.url))
    }

    // Verify state token using Convex
    const stateRecord = await convex.query(api.integrations.getOAuthState, { state })

    if (!stateRecord) {
      return NextResponse.redirect(new URL('/dashboard/settings/integrations?error=invalid_state', request.url))
    }

    // Delete used state
    await convex.mutation(api.integrations.deleteOAuthState, { state })

    // Dev mode simulation
    if (isDevMode || isDev) {
      console.log("[DEV MODE] Google OAuth - Simulating successful connection")

      const simulatedEmail = 'user@gmail.com'
      const tokenExpiresAt = Date.now() + 3600 * 1000

      // Store simulated connection
      await convex.mutation(api.integrations.upsertConnection, {
        companyId: stateRecord.companyId as Id<"companies">,
        provider: 'google',
        email: simulatedEmail,
        accessToken: 'dev_mode_access_token_' + uuidv4(),
        refreshToken: 'dev_mode_refresh_token_' + uuidv4(),
        tokenExpiresAt,
      })

      console.log(`[DEV MODE] Google Workspace connected for company ${stateRecord.companyId}`)
      console.log(`[DEV MODE] Simulated email: ${simulatedEmail}`)

      return NextResponse.redirect(new URL('/dashboard/settings/integrations?success=google_connected', request.url))
    }

    // Production: Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error("Google token exchange failed:", error)
      return NextResponse.redirect(new URL('/dashboard/settings/integrations?error=token_exchange_failed', request.url))
    }

    const tokens = await tokenResponse.json()

    // Get user profile to get email
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    })

    if (!profileResponse.ok) {
      console.error("Failed to get Google profile")
      return NextResponse.redirect(new URL('/dashboard/settings/integrations?error=profile_failed', request.url))
    }

    const profile = await profileResponse.json()
    const email = profile.email
    const tokenExpiresAt = Date.now() + (tokens.expires_in || 3600) * 1000

    // Store OAuth connection
    await convex.mutation(api.integrations.upsertConnection, {
      companyId: stateRecord.companyId as Id<"companies">,
      provider: 'google',
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
    })

    console.log(`Google Workspace connected for company ${stateRecord.companyId}, email: ${email}`)

    return NextResponse.redirect(new URL('/dashboard/settings/integrations?success=google_connected', request.url))
  } catch (error) {
    console.error("Google OAuth callback error:", error)
    return NextResponse.redirect(new URL('/dashboard/settings/integrations?error=callback_failed', request.url))
  }
}
