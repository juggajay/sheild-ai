import { NextRequest, NextResponse } from "next/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { getUserByToken } from "@/lib/auth"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Default notification preferences
const DEFAULT_PREFERENCES = {
  emailDigest: 'immediate', // 'immediate' | 'daily' | 'weekly' | 'none'
  emailNotifications: {
    cocReceived: true,
    cocVerified: true,
    cocFailed: true,
    expirationWarning: true,
    stopWorkRisk: true,
    communicationSent: true,
    exceptionUpdates: true
  },
  inAppNotifications: {
    cocReceived: true,
    cocVerified: true,
    cocFailed: true,
    expirationWarning: true,
    stopWorkRisk: true,
    communicationSent: true,
    exceptionUpdates: true
  },
  expirationWarningDays: 30 // Days before expiration to receive warning
}

// GET /api/user/preferences - Get user notification preferences
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const dbUser = await convex.query(api.users.getById, {
      id: user.id as Id<"users">,
    })

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Parse preferences or use defaults
    let preferences = DEFAULT_PREFERENCES
    if (dbUser.notificationPreferences && typeof dbUser.notificationPreferences === 'object') {
      preferences = { ...DEFAULT_PREFERENCES, ...dbUser.notificationPreferences as any }
    }

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error("Error fetching preferences:", error)
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
  }
}

// PUT /api/user/preferences - Update user notification preferences
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const body = await request.json()

    // Validate email digest value
    const validDigestOptions = ['immediate', 'daily', 'weekly', 'none']
    if (body.emailDigest && !validDigestOptions.includes(body.emailDigest)) {
      return NextResponse.json({ error: "Invalid email digest option" }, { status: 400 })
    }

    // Get current user
    const dbUser = await convex.query(api.users.getById, {
      id: user.id as Id<"users">,
    })

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Merge with existing preferences
    let currentPreferences = DEFAULT_PREFERENCES
    if (dbUser.notificationPreferences && typeof dbUser.notificationPreferences === 'object') {
      currentPreferences = { ...DEFAULT_PREFERENCES, ...dbUser.notificationPreferences as any }
    }

    const newPreferences = {
      ...currentPreferences,
      ...body,
      emailNotifications: {
        ...currentPreferences.emailNotifications,
        ...(body.emailNotifications || {})
      },
      inAppNotifications: {
        ...currentPreferences.inAppNotifications,
        ...(body.inAppNotifications || {})
      }
    }

    // Save preferences
    await convex.mutation(api.users.update, {
      id: user.id as Id<"users">,
      notificationPreferences: newPreferences,
    })

    return NextResponse.json({
      success: true,
      preferences: newPreferences,
      message: "Preferences saved successfully"
    })
  } catch (error) {
    console.error("Error updating preferences:", error)
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }
}
