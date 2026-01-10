import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Role type validator
const userRole = v.union(
  v.literal("admin"),
  v.literal("risk_manager"),
  v.literal("project_manager"),
  v.literal("project_administrator"),
  v.literal("read_only"),
  v.literal("subcontractor"),
  v.literal("broker")
)

// Get user by ID
export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id)
    if (!user) return null

    // Don't return password hash
    return {
      ...user,
      passwordHash: undefined,
    }
  },
})

// Get user by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first()

    return user
  },
})

// Get user by email (internal - includes password hash for auth)
export const getByEmailInternal = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first()
  },
})

// Get users by company
export const getByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    return users.map((user) => ({
      ...user,
      passwordHash: undefined,
    }))
  },
})

// Create user
export const create = mutation({
  args: {
    companyId: v.optional(v.id("companies")),
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    role: userRole,
    avatarUrl: v.optional(v.string()),
    notificationPreferences: v.optional(v.any()),
    invitationStatus: v.optional(v.string()),
    invitationToken: v.optional(v.string()),
    invitationExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first()

    if (existing) {
      throw new Error("Email already registered")
    }

    const userId = await ctx.db.insert("users", {
      companyId: args.companyId,
      email: args.email.toLowerCase(),
      passwordHash: args.passwordHash,
      name: args.name,
      phone: args.phone,
      role: args.role,
      avatarUrl: args.avatarUrl,
      notificationPreferences: args.notificationPreferences || {},
      invitationStatus: args.invitationStatus || "accepted",
      invitationToken: args.invitationToken,
      invitationExpiresAt: args.invitationExpiresAt,
      lastLoginAt: undefined,
      updatedAt: Date.now(),
    })

    return userId
  },
})

// Update user
export const update = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(userRole),
    avatarUrl: v.optional(v.string()),
    notificationPreferences: v.optional(v.any()),
    invitationStatus: v.optional(v.string()),
    invitationToken: v.optional(v.string()),
    invitationExpiresAt: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    )

    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    })

    return id
  },
})

// Update password
export const updatePassword = mutation({
  args: {
    id: v.id("users"),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      passwordHash: args.passwordHash,
      updatedAt: Date.now(),
    })
  },
})

// Update last login
export const updateLastLogin = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastLoginAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// Delete user
export const remove = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    // Delete all sessions for this user first
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.id))
      .collect()

    for (const session of sessions) {
      await ctx.db.delete(session._id)
    }

    // Delete the user
    await ctx.db.delete(args.id)
  },
})

// Get user by invitation token
export const getByInvitationToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_invitation_token", (q) => q.eq("invitationToken", args.token))
      .first()

    if (!user) return null
    if (user.invitationExpiresAt && user.invitationExpiresAt < Date.now()) {
      return null
    }

    return {
      ...user,
      passwordHash: undefined,
    }
  },
})

// Accept invitation
export const acceptInvitation = mutation({
  args: {
    id: v.id("users"),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      passwordHash: args.passwordHash,
      invitationStatus: "accepted",
      invitationToken: undefined,
      invitationExpiresAt: undefined,
      updatedAt: Date.now(),
    })
  },
})
