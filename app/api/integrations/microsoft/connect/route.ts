import { NextRequest, NextResponse } from "next/server"
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from "@/lib/auth"
import { cookies } from "next/headers"
import { v4 as uuidv4 } from "uuid"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Microsoft OAuth configuration
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/microsoft/callback`

// Dev mode check - if client ID is 'test' or not configured, use simulation
const isDevMode = !MICROSOFT_CLIENT_ID || MICROSOFT_CLIENT_ID === 'test' || MICROSOFT_CLIENT_ID.startsWith('test_')

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
      provider: 'microsoft',
      state,
    })

    // Dev mode simulation - redirect directly to callback
    if (isDevMode) {
      console.log("[DEV MODE] Microsoft 365 OAuth - Simulating connection flow")

      const devCallbackUrl = new URL('/api/integrations/microsoft/callback', request.url)
      devCallbackUrl.searchParams.set('state', state)
      devCallbackUrl.searchParams.set('code', 'dev_mode_simulated_code')
      devCallbackUrl.searchParams.set('dev', 'true')

      return NextResponse.redirect(devCallbackUrl)
    }

    // Production: Build Microsoft OAuth URL
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
