import { NextRequest, NextResponse } from "next/server"
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from "@/lib/auth"
import { cookies } from "next/headers"
import { v4 as uuidv4 } from "uuid"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google/callback`

// Dev mode check - if client ID is 'test' or not configured, use simulation
const isDevMode = !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'test' || GOOGLE_CLIENT_ID.startsWith('test_')

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const token = (await cookieStore).get("auth_token")?.value

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

    // Generate state token for CSRF protection
    const state = uuidv4()

    // Store state in Convex for verification
    await convex.mutation(api.integrations.createOAuthState, {
      userId: user.id as Id<"users">,
      companyId: user.company_id as Id<"companies">,
      provider: 'google',
      state,
    })

    // Dev mode simulation - redirect directly to callback
    if (isDevMode) {
      console.log("[DEV MODE] Google OAuth - Simulating connection flow")

      const devCallbackUrl = new URL('/api/integrations/google/callback', request.url)
      devCallbackUrl.searchParams.set('state', state)
      devCallbackUrl.searchParams.set('code', 'dev_mode_simulated_code')
      devCallbackUrl.searchParams.set('dev', 'true')

      return NextResponse.redirect(devCallbackUrl)
    }

    // Production: Build Google OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID!)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
    authUrl.searchParams.set('scope', 'openid profile email https://www.googleapis.com/auth/gmail.readonly')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error("Google OAuth connect error:", error)
    return NextResponse.json(
      { error: "Failed to initiate Google connection" },
      { status: 500 }
    )
  }
}
