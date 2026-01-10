import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Get session by token
export const getSessionByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (!session) return null

    // Check if session is expired
    if (session.expiresAt < Date.now()) {
      return null
    }

    return session
  },
})

// Create a new session
export const createSession = mutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("sessions", {
      userId: args.userId,
      token: args.token,
      expiresAt: args.expiresAt,
    })
    return sessionId
  },
})

// Delete session (logout)
export const deleteSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (session) {
      await ctx.db.delete(session._id)
    }
  },
})

// Delete all sessions for a user
export const deleteUserSessions = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    for (const session of sessions) {
      await ctx.db.delete(session._id)
    }
  },
})

// Delete expired sessions (cleanup)
export const deleteExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const expiredSessions = await ctx.db
      .query("sessions")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect()

    for (const session of expiredSessions) {
      await ctx.db.delete(session._id)
    }

    return expiredSessions.length
  },
})

// Get user with session
export const getUserWithSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (!session || session.expiresAt < Date.now()) {
      return null
    }

    const user = await ctx.db.get(session.userId)
    if (!user) return null

    // Get company if user has one
    let company = null
    if (user.companyId) {
      company = await ctx.db.get(user.companyId)
    }

    return {
      user: {
        ...user,
        // Don't return password hash
        passwordHash: undefined,
      },
      company,
      session,
    }
  },
})

// Create password reset token
export const createPasswordResetToken = mutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const tokenId = await ctx.db.insert("passwordResetTokens", {
      userId: args.userId,
      token: args.token,
      expiresAt: args.expiresAt,
      used: false,
    })
    return tokenId
  },
})

// Get password reset token
export const getPasswordResetToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (!tokenDoc) return null
    if (tokenDoc.used) return null
    if (tokenDoc.expiresAt < Date.now()) return null

    return tokenDoc
  },
})

// Mark password reset token as used
export const markPasswordResetTokenUsed = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (tokenDoc) {
      await ctx.db.patch(tokenDoc._id, { used: true })
    }
  },
})

// Create magic link token
export const createMagicLinkToken = mutation({
  args: {
    email: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const tokenId = await ctx.db.insert("magicLinkTokens", {
      email: args.email.toLowerCase(),
      token: args.token,
      expiresAt: args.expiresAt,
      used: false,
    })
    return tokenId
  },
})

// Get magic link token
export const getMagicLinkToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("magicLinkTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (!tokenDoc) return null
    if (tokenDoc.used) return null
    if (tokenDoc.expiresAt < Date.now()) return null

    return tokenDoc
  },
})

// Mark magic link token as used
export const markMagicLinkTokenUsed = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("magicLinkTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (tokenDoc) {
      await ctx.db.patch(tokenDoc._id, { used: true })
    }
  },
})
