import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { v4 as uuidv4 } from "uuid"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google/callback`

// Dev mode check
const isDevMode = !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'test' || GOOGLE_CLIENT_ID.startsWith('test_')

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
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

    // Verify state token
    const stateRecord = db.prepare(`
      SELECT os.*, u.company_id
      FROM oauth_states os
      JOIN users u ON os.user_id = u.id
      WHERE os.state = ? AND os.provider = 'google' AND os.expires_at > datetime('now')
    `).get(state) as any

    if (!stateRecord) {
      return NextResponse.redirect(new URL('/dashboard/settings/integrations?error=invalid_state', request.url))
    }

    // Delete used state
    db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state)

    // Dev mode simulation
    if (isDevMode || isDev) {
      console.log("[DEV MODE] Google OAuth - Simulating successful connection")
      console.log("[DEV MODE] Would exchange code for tokens and store credentials")

      // Simulate storing OAuth tokens
      const connectionId = uuidv4()
      const simulatedEmail = 'user@gmail.com'

      // Store simulated connection
      db.prepare(`
        INSERT INTO oauth_connections (id, company_id, provider, email, access_token, refresh_token, token_expires_at, created_at, updated_at)
        VALUES (?, ?, 'google', ?, ?, ?, datetime('now', '+1 hour'), datetime('now'), datetime('now'))
        ON CONFLICT(company_id, provider) DO UPDATE SET
          email = excluded.email,
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          token_expires_at = excluded.token_expires_at,
          updated_at = datetime('now')
      `).run(
        connectionId,
        stateRecord.company_id,
        simulatedEmail,
        'dev_mode_access_token_' + uuidv4(),
        'dev_mode_refresh_token_' + uuidv4()
      )

      console.log(`[DEV MODE] Google Workspace connected for company ${stateRecord.company_id}`)
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

    // Store OAuth connection
    const connectionId = uuidv4()
    db.prepare(`
      INSERT INTO oauth_connections (id, company_id, provider, email, access_token, refresh_token, token_expires_at, created_at, updated_at)
      VALUES (?, ?, 'google', ?, ?, ?, datetime('now', '+' || ? || ' seconds'), datetime('now'), datetime('now'))
      ON CONFLICT(company_id, provider) DO UPDATE SET
        email = excluded.email,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        updated_at = datetime('now')
    `).run(
      connectionId,
      stateRecord.company_id,
      email,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_in || 3600
    )

    console.log(`Google Workspace connected for company ${stateRecord.company_id}, email: ${email}`)

    return NextResponse.redirect(new URL('/dashboard/settings/integrations?success=google_connected', request.url))
  } catch (error) {
    console.error("Google OAuth callback error:", error)
    return NextResponse.redirect(new URL('/dashboard/settings/integrations?error=callback_failed', request.url))
  }
}
