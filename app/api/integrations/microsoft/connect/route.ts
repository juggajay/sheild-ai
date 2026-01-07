import { NextRequest, NextResponse } from "next/server"
import { getUserByToken } from "@/lib/auth"
import { cookies } from "next/headers"
import { getDb } from "@/lib/db"
import { v4 as uuidv4 } from "uuid"

// Microsoft OAuth configuration
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/microsoft/callback`

// Dev mode check - if client ID is 'test' or not configured, use simulation
const isDevMode = !MICROSOFT_CLIENT_ID || MICROSOFT_CLIENT_ID === 'test' || MICROSOFT_CLIENT_ID.startsWith('test_')

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can manage integrations
    if (user.role !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Dev mode simulation - create a simulated OAuth state and redirect
    if (isDevMode) {
      console.log("[DEV MODE] Microsoft 365 OAuth - Simulating connection flow")

      const db = getDb()
      // Generate state token for CSRF protection
      const state = uuidv4()

      // Store state in database for verification
      db.prepare(`
        INSERT INTO oauth_states (id, user_id, company_id, provider, state, created_at, expires_at)
        VALUES (?, ?, ?, 'microsoft', ?, datetime('now'), datetime('now', '+10 minutes'))
      `).run(uuidv4(), user.id, user.company_id, state)

      // In dev mode, redirect to our own callback with simulated success
      const devCallbackUrl = new URL('/api/integrations/microsoft/callback', request.url)
      devCallbackUrl.searchParams.set('state', state)
      devCallbackUrl.searchParams.set('code', 'dev_mode_simulated_code')
      devCallbackUrl.searchParams.set('dev', 'true')

      return NextResponse.redirect(devCallbackUrl)
    }

    // Production OAuth flow
    const db = getDb()
    const state = uuidv4()

    // Store state in database for verification
    db.prepare(`
      INSERT INTO oauth_states (id, user_id, company_id, provider, state, created_at, expires_at)
      VALUES (?, ?, ?, 'microsoft', ?, datetime('now'), datetime('now', '+10 minutes'))
    `).run(uuidv4(), user.id, user.company_id, state)

    // Build Microsoft OAuth URL
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    authUrl.searchParams.set('client_id', MICROSOFT_CLIENT_ID!)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', MICROSOFT_REDIRECT_URI)
    authUrl.searchParams.set('scope', 'openid profile email Mail.Read Mail.ReadBasic offline_access')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('response_mode', 'query')

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error("Microsoft OAuth connect error:", error)
    return NextResponse.json(
      { error: "Failed to initiate Microsoft connection" },
      { status: 500 }
    )
  }
}
