import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const apiKey = process.env.SENDGRID_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "SendGrid API key not configured. Set SENDGRID_API_KEY in environment variables." },
        { status: 400 }
      )
    }

    // In development mode, simulate success
    if (process.env.NODE_ENV === "development" && apiKey === "test" || apiKey === "dev") {
      console.log("[DEV MODE] SendGrid test email simulated")
      return NextResponse.json({
        success: true,
        message: "Test email simulated (development mode)"
      })
    }

    // In production, actually test the SendGrid API
    // This makes a simple API call to verify the key is valid
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: user.email }]
        }],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || "noreply@riskshield.ai",
          name: "RiskShield AI"
        },
        subject: "RiskShield AI - SendGrid Integration Test",
        content: [{
          type: "text/html",
          value: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3B82F6;">SendGrid Integration Test</h2>
              <p>This is a test email from RiskShield AI to verify your SendGrid integration is working correctly.</p>
              <p style="color: #64748B; font-size: 14px;">Sent at: ${new Date().toISOString()}</p>
            </div>
          `
        }]
      })
    })

    if (response.ok || response.status === 202) {
      return NextResponse.json({
        success: true,
        message: "Test email sent successfully"
      })
    } else {
      const errorText = await response.text()
      console.error("SendGrid API error:", errorText)
      return NextResponse.json(
        { error: "SendGrid API returned an error. Please verify your API key." },
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
