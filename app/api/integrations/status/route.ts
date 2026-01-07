import { NextResponse } from "next/server"

// Check environment variables to determine integration status
export async function GET() {
  try {
    // Check Microsoft 365 OAuth configuration
    const hasMicrosoft365 = !!(
      process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET
    )

    // Check Google OAuth configuration
    const hasGoogle = !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
    )

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
          connected: hasMicrosoft365,
          // In a real implementation, we'd check if there's an active OAuth token stored
          email: hasMicrosoft365 ? undefined : undefined,
          lastSync: undefined
        },
        google: {
          connected: hasGoogle,
          email: hasGoogle ? undefined : undefined,
          lastSync: undefined
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
