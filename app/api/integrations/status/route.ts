import { NextResponse } from "next/server"
import { getUserByToken } from "@/lib/auth"
import { cookies } from "next/headers"
import { getDb } from "@/lib/db"
import { isProcoreDevMode } from "@/lib/procore"

interface ProcoreConnection {
  procore_company_id: number | null
  procore_company_name: string | null
  pending_company_selection: number
  last_sync_at: string | null
}

// Check environment variables and database for integration status
export async function GET() {
  try {
    const db = getDb()
    const cookieStore = cookies()
    const token = (await cookieStore).get("auth_token")?.value

    let microsoftConnection = null
    let googleConnection = null
    let procoreConnection: ProcoreConnection | null = null
    let procoreSyncStats: { projectCount: number; vendorCount: number } | null = null

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

        // Check for Procore connection
        try {
          procoreConnection = db.prepare(`
            SELECT procore_company_id, procore_company_name, pending_company_selection, last_sync_at
            FROM oauth_connections
            WHERE company_id = ? AND provider = 'procore'
          `).get(user.company_id) as ProcoreConnection | null
        } catch (e) {
          // Table may not exist yet or column doesn't exist
        }

        // Get Procore sync stats if connected
        if (procoreConnection && procoreConnection.procore_company_id) {
          try {
            const projectCount = db.prepare(`
              SELECT COUNT(*) as count FROM procore_mappings
              WHERE company_id = ? AND procore_entity_type = 'project'
            `).get(user.company_id) as { count: number }

            const vendorCount = db.prepare(`
              SELECT COUNT(*) as count FROM procore_mappings
              WHERE company_id = ? AND procore_entity_type = 'vendor'
            `).get(user.company_id) as { count: number }

            procoreSyncStats = {
              projectCount: projectCount?.count || 0,
              vendorCount: vendorCount?.count || 0
            }
          } catch (e) {
            // procore_mappings table may not exist
          }
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

    // Check Procore dev mode
    const procoreDevMode = isProcoreDevMode()
    const isProcoreConnected = procoreConnection &&
      procoreConnection.procore_company_id &&
      !procoreConnection.pending_company_selection

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
      },
      construction: {
        procore: {
          connected: !!isProcoreConnected,
          devMode: procoreDevMode,
          companyName: procoreConnection?.procore_company_name || undefined,
          companyId: procoreConnection?.procore_company_id || undefined,
          pendingCompanySelection: !!procoreConnection?.pending_company_selection,
          lastSync: procoreConnection?.last_sync_at || undefined,
          projectCount: procoreSyncStats?.projectCount,
          vendorCount: procoreSyncStats?.vendorCount
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
