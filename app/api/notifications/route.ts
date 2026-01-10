import { NextRequest, NextResponse } from "next/server"
import { getConvex, api } from "@/lib/convex"
import type { Id } from "@/convex/_generated/dataModel"

// GET /api/notifications - List notifications for current user
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const convex = getConvex()

    // Use Convex for session validation (consistent with login route)
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const { user } = sessionData

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = parseInt(searchParams.get("offset") || "0")
    const unreadOnly = searchParams.get("unread") === "true"

    const result = await convex.query(api.notifications.getByUser, {
      userId: user._id as Id<"users">,
      unreadOnly,
      limit,
      offset,
    })

    return NextResponse.json({
      notifications: result.notifications,
      unreadCount: result.unreadCount,
      totalCount: result.totalCount,
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

// POST /api/notifications - Create a notification (internal use)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const convex = getConvex()

    // Use Convex for session validation (consistent with login route)
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const { user } = sessionData

    const body = await request.json()
    const {
      userId,
      type,
      title,
      message,
      link,
      entityType,
      entityId,
    } = body

    // Get company_id from user
    const targetUserId = userId || user._id
    const targetUserCompanyId = await convex.query(api.notifications.getUserCompanyId, {
      userId: targetUserId as Id<"users">,
    })

    if (!targetUserCompanyId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Security: Prevent IDOR - users can only create notifications for users in their own company
    if (targetUserCompanyId !== user.companyId) {
      return NextResponse.json({ error: "Cannot create notifications for users outside your company" }, { status: 403 })
    }

    const id = await convex.mutation(api.notifications.create, {
      userId: targetUserId as Id<"users">,
      companyId: targetUserCompanyId as Id<"companies">,
      type: type as "coc_received" | "coc_verified" | "coc_failed" | "exception_created" | "exception_approved" | "exception_expired" | "expiration_warning" | "communication_sent" | "stop_work_risk" | "system",
      title,
      message,
      link: link || undefined,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
    })

    return NextResponse.json({ id, success: true })
  } catch (error) {
    console.error("Error creating notification:", error)
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const convex = getConvex()

    // Use Convex for session validation (consistent with login route)
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const { user } = sessionData

    const body = await request.json()
    const { notificationIds, markAllRead } = body

    if (markAllRead) {
      // Mark all notifications as read for this user
      await convex.mutation(api.notifications.markAllAsRead, {
        userId: user._id as Id<"users">,
      })

      return NextResponse.json({ success: true, message: "All notifications marked as read" })
    }

    if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      // Mark specific notifications as read
      await convex.mutation(api.notifications.markMultipleAsRead, {
        notificationIds: notificationIds as Id<"notifications">[],
        userId: user._id as Id<"users">,
      })

      return NextResponse.json({ success: true, message: "Notifications marked as read" })
    }

    return NextResponse.json({ error: "No notification IDs provided" }, { status: 400 })
  } catch (error) {
    console.error("Error marking notifications as read:", error)
    return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 })
  }
}

// DELETE /api/notifications - Clear all notifications
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const convex = getConvex()

    // Use Convex for session validation (consistent with login route)
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const { user } = sessionData

    // Delete all notifications for this user
    await convex.mutation(api.notifications.deleteAllForUser, {
      userId: user._id as Id<"users">,
    })

    return NextResponse.json({ success: true, message: "All notifications cleared" })
  } catch (error) {
    console.error("Error clearing notifications:", error)
    return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 })
  }
}
