import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getUserByToken } from "@/lib/auth"

export async function POST() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !phoneNumber) {
      return NextResponse.json(
        { error: "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in environment variables." },
        { status: 400 }
      )
    }

    // In development mode with test credentials, simulate success
    if (process.env.NODE_ENV === "development" && (accountSid === "test" || accountSid.startsWith("AC_TEST"))) {
      console.log("[DEV MODE] Twilio test SMS simulated")
      return NextResponse.json({
        success: true,
        message: "Test SMS simulated (development mode)"
      })
    }

    // For actual testing, we'd need a test phone number
    // Twilio provides test credentials that don't actually send SMS
    // https://www.twilio.com/docs/iam/test-credentials

    // Make a request to Twilio's API to verify credentials
    const testUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`

    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      console.log(`Twilio account verified: ${data.friendly_name || data.sid}`)

      return NextResponse.json({
        success: true,
        message: "Twilio credentials verified successfully"
      })
    } else {
      const errorData = await response.json().catch(() => ({}))
      console.error("Twilio API error:", errorData)
      return NextResponse.json(
        { error: "Twilio credentials are invalid. Please verify your Account SID and Auth Token." },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Twilio test failed:", error)
    return NextResponse.json(
      { error: "Failed to test Twilio connection" },
      { status: 500 }
    )
  }
}
