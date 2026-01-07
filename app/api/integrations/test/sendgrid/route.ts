import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getUserByToken } from "@/lib/auth"
import { sendEmail, isSendGridConfigured, textToHtml } from "@/lib/sendgrid"

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

    if (!isSendGridConfigured()) {
      return NextResponse.json(
        { error: "SendGrid API key not configured. Set SENDGRID_API_KEY in environment variables." },
        { status: 400 }
      )
    }

    const apiKey = process.env.SENDGRID_API_KEY

    // In development mode with test key, simulate success
    if (process.env.NODE_ENV === "development" && (apiKey === "test" || apiKey === "dev")) {
      console.log("[DEV MODE] SendGrid test email simulated")
      return NextResponse.json({
        success: true,
        message: "Test email simulated (development mode)"
      })
    }

    // Send actual test email via SendGrid SDK
    const testBody = `SendGrid Integration Test

This is a test email from RiskShield AI to verify your SendGrid integration is working correctly.

Sent at: ${new Date().toISOString()}`

    const result = await sendEmail({
      to: user.email,
      subject: "RiskShield AI - SendGrid Integration Test",
      html: textToHtml(testBody),
      text: testBody
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Test email sent successfully",
        messageId: result.messageId
      })
    } else {
      console.error("SendGrid API error:", result.error)
      return NextResponse.json(
        { error: result.error || "SendGrid API returned an error. Please verify your API key." },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("SendGrid test failed:", error)
    return NextResponse.json(
      { error: "Failed to test SendGrid connection" },
      { status: 500 }
    )
  }
}
