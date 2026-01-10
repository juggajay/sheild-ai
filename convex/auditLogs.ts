import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Create audit log entry
export const create = mutation({
  args: {
    companyId: v.optional(v.id("companies")),
    userId: v.optional(v.id("users")),
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    details: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("auditLogs", {
      companyId: args.companyId,
      userId: args.userId,
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      details: args.details || {},
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    })
    return logId
  },
})

// Get audit logs by company
export const getByCompany = query({
  args: {
    companyId: v.id("companies"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(args.limit || 100)

    return logs
  },
})

// Get audit logs by user
export const getByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 100)

    return logs
  },
})

// Get audit logs by entity
export const getByEntity = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .order("desc")
      .take(args.limit || 100)

    return logs
  },
})

// Get recent audit logs
export const getRecent = query({
  args: {
    companyId: v.optional(v.id("companies")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.companyId) {
      return await ctx.db
        .query("auditLogs")
        .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
        .order("desc")
        .take(args.limit || 50)
    }

    return await ctx.db
      .query("auditLogs")
      .order("desc")
      .take(args.limit || 50)
  },
})

// List audit logs by company with filtering and user details
export const listByCompanyWithFilters = query({
  args: {
    companyId: v.id("companies"),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    action: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get all logs for the company
    let logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .collect()

    // Apply filters
    if (args.entityType) {
      logs = logs.filter((log) => log.entityType === args.entityType)
    }
    if (args.entityId) {
      logs = logs.filter((log) => log.entityId === args.entityId)
    }
    if (args.action) {
      logs = logs.filter((log) => log.action === args.action)
    }

    const total = logs.length

    // Apply pagination
    const offset = args.offset || 0
    const limit = args.limit || 100
    const paginatedLogs = logs.slice(offset, offset + limit)

    // Enrich with user details
    const results = await Promise.all(
      paginatedLogs.map(async (log) => {
        const user = log.userId ? await ctx.db.get(log.userId) : null
        return {
          ...log,
          user_name: user?.name || null,
          user_email: user?.email || null,
        }
      })
    )

    return {
      logs: results,
      total,
      limit,
      offset,
    }
  },
})

// Get audit logs by entity with user details (for audit trail export)
export const getByEntityWithDetails = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .order("asc") // Chronological order for audit trail
      .collect()

    // Enrich with user details
    const results = await Promise.all(
      logs.map(async (log) => {
        const user = log.userId ? await ctx.db.get(log.userId) : null
        return {
          id: log._id,
          action: log.action,
          details: log.details ? JSON.stringify(log.details) : "{}",
          created_at: new Date(log._creationTime).toISOString(),
          ip_address: log.ipAddress || null,
          user_name: user?.name || null,
          user_email: user?.email || null,
        }
      })
    )

    return results
  },
})
