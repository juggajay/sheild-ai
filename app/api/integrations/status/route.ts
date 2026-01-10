import { NextRequest, NextResponse } from "next/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { getUserByToken } from "@/lib/auth"
import { isProcoreDevMode } from "@/lib/procore"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Check environment variables and database for integration status
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value

    let microsoftConnection = null
    let googleConnection = null
    let procoreConnection = null
    let procoreSyncStats: { projectCount: number; vendorCount: number } | null = null

    // If authenticated, check for actual OAuth connections
    if (token) {
      const user = getUserByToken(token)

      if (user && user.company_id) {
        // Get all connection statuses from Convex
        try {
          const status = await convex.query(api.integrations.getIntegrationStatus, {
            companyId: user.company_id as Id<"companies">,
          })

          microsoftConnection = status.microsoft.connected ? {
            email: status.microsoft.email,
            last_sync_at: status.microsoft.lastSyncAt ? new Date(status.microsoft.lastSyncAt).toISOString() : null,
          } : null

          googleConnection = status.google.connected ? {
            email: status.google.email,
            last_sync_at: status.google.lastSyncAt ? new Date(status.google.lastSyncAt).toISOString() : null,
          } : null

          if (status.procore.connected) {
            procoreConnection = {
              procore_company_id: status.procore.procoreCompanyId,
              procore_company_name: status.procore.procoreCompanyName,
              pending_company_selection: status.procore.pendingCompanySelection ? 1 : 0,
              last_sync_at: status.procore.lastSyncAt ? new Date(status.procore.lastSyncAt).toISOString() : null,
            }
          }

          // Get Procore sync stats if connected
          if (procoreConnection && procoreConnection.procore_company_id) {
            const mappings = await convex.query(api.integrations.getProcoreMappingsByCompany, {
              companyId: user.company_id as Id<"companies">,
            })

            procoreSyncStats = {
              projectCount: mappings.filter(m => m.procoreEntityType === 'project').length,
              vendorCount: mappings.filter(m => m.procoreEntityType === 'vendor').length,
            }
          }
        } catch (e) {
          // Connections may not exist yet
          console.log('No integration connections found')
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
