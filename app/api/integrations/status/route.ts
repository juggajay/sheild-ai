import { NextResponse } from "next/server"
import { getUserByToken } from "@/lib/auth"
import { cookies } from "next/headers"
import { getDb } from "@/lib/db"

// Check environment variables and database for integration status
export async function GET() {
  try {
    const db = getDb()
    const cookieStore = cookies()
    const token = cookieStore.get("auth_token")?.value

    let microsoftConnection = null
    let googleConnection = null

    // If authenticated, check for actual OAuth connections
    if (token) {
      const user = await getUserByToken(token)
      if (user && user.company_id) {
        // Check for Microsoft 365 connection
        try {
          microsoftConnection = db.prepare(`
            SELECT email, last_sync_at FROM oauth_connections
            WHERE company_id = ? AND provider = 'microsoft'
          `).get(user.company_id) as any
        } catch (e) {
          // Table may not exist yet
        }

        // Check for Google connection
        try {
          googleConnection = db.prepare(`
            SELECT email, last_sync_at FROM oauth_connections
            WHERE company_id = ? AND provider = 'google'
          `).get(user.company_id) as any
        } catch (e) {
          // Table may not exist yet
        }
      }
    }

    // Check environment variables for configuration
    const hasMicrosoftConfig = !!(
      process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET
    )

    const hasGoogleConfig = !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
    )

    // In dev mode, allow connection even without env vars configured
    const isDevMode = !process.env.MICROSOFT_CLIENT_ID ||
                      process.env.MICROSOFT_CLIENT_ID === 'test' ||
                      process.env.MICROSOFT_CLIENT_ID?.startsWith('test_')

    // Check SendGrid configuration
    const hasSendGrid = !!process.env.SENDGRID_API_KEY

    // Check Twilio configuration
    const hasTwilio = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    )

    return NextResponse.json({
      email: {
        microsoft365: {
          connected: !!microsoftConnection,
          configured: hasMicrosoftConfig || isDevMode,
          email: microsoftConnection?.email || undefined,
          lastSync: microsoftConnection?.last_sync_at || undefined,
          devMode: isDevMode && !hasMicrosoftConfig
        },
        google: {
          connected: !!googleConnection,
          configured: hasGoogleConfig || isDevMode,
          email: googleConnection?.email || undefined,
          lastSync: googleConnection?.last_sync_at || undefined,
          devMode: isDevMode && !hasGoogleConfig
        }
      },
      communication: {
        sendgrid: {
          configured: hasSendGrid,
          verified: hasSendGrid ? undefined : undefined
        },
        twilio: {
          configured: hasTwilio,
          verified: hasTwilio ? undefined : undefined
        }
      }
    })
  } catch (error) {
    console.error("Failed to get integration status:", error)
    return NextResponse.json(
      { error: "Failed to get integration status" },
      { status: 500 }
    )
  }
}
