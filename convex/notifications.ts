import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Notification type validator (must match schema.ts)
const notificationType = v.union(
  v.literal("coc_received"),
  v.literal("coc_verified"),
  v.literal("coc_failed"),
  v.literal("exception_created"),
  v.literal("exception_approved"),
  v.literal("exception_expired"),
  v.literal("expiration_warning"),
  v.literal("communication_sent"),
  v.literal("stop_work_risk"),
  v.literal("system")
)

// Get notifications by user
export const getByUser = query({
  args: {
    userId: v.id("users"),
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let notifications
    if (args.unreadOnly) {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user_read", (q) =>
          q.eq("userId", args.userId).eq("read", false)
        )
        .order("desc")
        .collect()
    } else {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .collect()
    }

    // Apply pagination
    const offset = args.offset || 0
    const limit = args.limit || 20
    const paginatedNotifications = notifications.slice(offset, offset + limit)

    // Get counts
    const unreadCount = notifications.filter((n) => !n.read).length
    const totalCount = notifications.length

    // Convert to legacy format
    const results = paginatedNotifications.map((n) => ({
      id: n._id,
      user_id: n.userId,
      company_id: n.companyId,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link || null,
      entity_type: n.entityType || null,
      entity_id: n.entityId || null,
      read: n.read ? 1 : 0,
      created_at: new Date(n._creationTime).toISOString(),
    }))

    return {
      notifications: results,
      unreadCount,
      totalCount,
    }
  },
})

// Create notification
export const create = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    type: notificationType,
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      companyId: args.companyId,
      type: args.type,
      title: args.title,
      message: args.message,
      link: args.link,
      entityType: args.entityType,
      entityId: args.entityId,
      read: false,
    })
    return notificationId
  },
})

// Mark notification as read
export const markAsRead = mutation({
  args: {
    id: v.id("notifications"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.id)
    if (!notification || notification.userId !== args.userId) {
      throw new Error("Notification not found or access denied")
    }

    await ctx.db.patch(args.id, { read: true })
  },
})

// Mark multiple notifications as read
export const markMultipleAsRead = mutation({
  args: {
    notificationIds: v.array(v.id("notifications")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    for (const notificationId of args.notificationIds) {
      const notification = await ctx.db.get(notificationId)
      if (notification && notification.userId === args.userId) {
        await ctx.db.patch(notificationId, { read: true })
      }
    }
  },
})

// Mark all notifications as read for user
export const markAllAsRead = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", args.userId).eq("read", false)
      )
      .collect()

    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, { read: true })
    }

    return unreadNotifications.length
  },
})

// Delete all notifications for user
export const deleteAllForUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    for (const notification of notifications) {
      await ctx.db.delete(notification._id)
    }

    return notifications.length
  },
})

// Get user by ID (for company validation)
export const getUserCompanyId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    return user?.companyId || null
  },
})
