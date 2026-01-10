import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// OAuth provider validator
const oauthProvider = v.union(
  v.literal("microsoft"),
  v.literal("google"),
  v.literal("procore")
)

// ========== OAuth States (CSRF Protection) ==========

// Create OAuth state
export const createOAuthState = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    provider: oauthProvider,
    state: v.string(),
  },
  handler: async (ctx, args) => {
    // Delete any existing states for this user/provider
    const existing = await ctx.db
      .query("oauthStates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    for (const s of existing.filter(s => s.provider === args.provider)) {
      await ctx.db.delete(s._id)
    }

    const id = await ctx.db.insert("oauthStates", {
      userId: args.userId,
      companyId: args.companyId,
      provider: args.provider,
      state: args.state,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    })
    return id
  },
})

// Get and validate OAuth state
export const getOAuthState = query({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const stateRecord = await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first()

    if (!stateRecord) return null
    if (stateRecord.expiresAt < Date.now()) return null

    return stateRecord
  },
})

// Delete OAuth state after use
export const deleteOAuthState = mutation({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const stateRecord = await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first()

    if (stateRecord) {
      await ctx.db.delete(stateRecord._id)
    }
  },
})

// ========== OAuth Connections ==========

// Get OAuth connection by company and provider
export const getConnection = query({
  args: {
    companyId: v.id("companies"),
    provider: oauthProvider,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oauthConnections")
      .withIndex("by_company_provider", (q) =>
        q.eq("companyId", args.companyId).eq("provider", args.provider)
      )
      .first()
  },
})

// Get all connections for a company
export const getConnectionsByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oauthConnections")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()
  },
})

// Create or update OAuth connection
export const upsertConnection = mutation({
  args: {
    companyId: v.id("companies"),
    provider: oauthProvider,
    email: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    procoreCompanyId: v.optional(v.number()),
    procoreCompanyName: v.optional(v.string()),
    pendingCompanySelection: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("oauthConnections")
      .withIndex("by_company_provider", (q) =>
        q.eq("companyId", args.companyId).eq("provider", args.provider)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken || existing.refreshToken,
        tokenExpiresAt: args.tokenExpiresAt,
        procoreCompanyId: args.procoreCompanyId,
        procoreCompanyName: args.procoreCompanyName,
        pendingCompanySelection: args.pendingCompanySelection,
        updatedAt: Date.now(),
      })
      return existing._id
    }

    return await ctx.db.insert("oauthConnections", {
      companyId: args.companyId,
      provider: args.provider,
      email: args.email,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      procoreCompanyId: args.procoreCompanyId,
      procoreCompanyName: args.procoreCompanyName,
      pendingCompanySelection: args.pendingCompanySelection,
      updatedAt: Date.now(),
    })
  },
})

// Update OAuth connection tokens
export const updateConnectionTokens = mutation({
  args: {
    companyId: v.id("companies"),
    provider: oauthProvider,
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("oauthConnections")
      .withIndex("by_company_provider", (q) =>
        q.eq("companyId", args.companyId).eq("provider", args.provider)
      )
      .first()

    if (!connection) {
      throw new Error("Connection not found")
    }

    await ctx.db.patch(connection._id, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken || connection.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      updatedAt: Date.now(),
    })
  },
})

// Update Procore company selection
export const updateProcoreCompany = mutation({
  args: {
    companyId: v.id("companies"),
    procoreCompanyId: v.number(),
    procoreCompanyName: v.string(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("oauthConnections")
      .withIndex("by_company_provider", (q) =>
        q.eq("companyId", args.companyId).eq("provider", "procore")
      )
      .first()

    if (!connection) {
      throw new Error("Procore connection not found")
    }

    await ctx.db.patch(connection._id, {
      procoreCompanyId: args.procoreCompanyId,
      procoreCompanyName: args.procoreCompanyName,
      pendingCompanySelection: false,
      updatedAt: Date.now(),
    })
  },
})

// Update last sync time
export const updateLastSync = mutation({
  args: {
    companyId: v.id("companies"),
    provider: oauthProvider,
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("oauthConnections")
      .withIndex("by_company_provider", (q) =>
        q.eq("companyId", args.companyId).eq("provider", args.provider)
      )
      .first()

    if (connection) {
      await ctx.db.patch(connection._id, {
        lastSyncAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  },
})

// Delete OAuth connection
export const deleteConnection = mutation({
  args: {
    companyId: v.id("companies"),
    provider: oauthProvider,
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("oauthConnections")
      .withIndex("by_company_provider", (q) =>
        q.eq("companyId", args.companyId).eq("provider", args.provider)
      )
      .first()

    if (!connection) {
      return { deleted: false, connection: null }
    }

    // Store connection info for return
    const connectionInfo = {
      procoreCompanyId: connection.procoreCompanyId,
      procoreCompanyName: connection.procoreCompanyName,
    }

    await ctx.db.delete(connection._id)

    // For Procore, pause mappings instead of deleting them
    if (args.provider === "procore") {
      const mappings = await ctx.db
        .query("procoreMappings")
        .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
        .collect()

      for (const mapping of mappings) {
        await ctx.db.patch(mapping._id, {
          syncStatus: "paused",
          updatedAt: Date.now(),
        })
      }
    }

    return { deleted: true, connection: connectionInfo }
  },
})

// ========== Integration Status ==========

// Get all integration statuses for a company
export const getIntegrationStatus = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const connections = await ctx.db
      .query("oauthConnections")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const status: Record<string, {
      connected: boolean
      email?: string | null
      lastSyncAt?: number | null
      procoreCompanyId?: number | null
      procoreCompanyName?: string | null
      pendingCompanySelection?: boolean | null
    }> = {
      microsoft: { connected: false },
      google: { connected: false },
      procore: { connected: false },
    }

    for (const conn of connections) {
      status[conn.provider] = {
        connected: true,
        email: conn.email,
        lastSyncAt: conn.lastSyncAt,
        procoreCompanyId: conn.procoreCompanyId,
        procoreCompanyName: conn.procoreCompanyName,
        pendingCompanySelection: conn.pendingCompanySelection,
      }
    }

    return status
  },
})

// ========== Procore Mappings ==========

// Get mapping by Procore entity
export const getProcoreMapping = query({
  args: {
    procoreCompanyId: v.number(),
    procoreEntityType: v.union(v.literal("project"), v.literal("vendor")),
    procoreEntityId: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("procoreMappings")
      .withIndex("by_procore", (q) =>
        q
          .eq("procoreCompanyId", args.procoreCompanyId)
          .eq("procoreEntityType", args.procoreEntityType)
          .eq("procoreEntityId", args.procoreEntityId)
      )
      .first()
  },
})

// Get mapping by Shield entity
export const getShieldMapping = query({
  args: {
    shieldEntityType: v.union(v.literal("project"), v.literal("subcontractor")),
    shieldEntityId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("procoreMappings")
      .withIndex("by_shield", (q) =>
        q
          .eq("shieldEntityType", args.shieldEntityType)
          .eq("shieldEntityId", args.shieldEntityId)
      )
      .first()
  },
})

// Get all mappings for a company
export const getProcoreMappingsByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("procoreMappings")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()
  },
})

// Create or update Procore mapping
export const upsertProcoreMapping = mutation({
  args: {
    companyId: v.id("companies"),
    procoreCompanyId: v.number(),
    procoreEntityType: v.union(v.literal("project"), v.literal("vendor")),
    procoreEntityId: v.number(),
    shieldEntityType: v.union(v.literal("project"), v.literal("subcontractor")),
    shieldEntityId: v.string(),
    syncDirection: v.union(
      v.literal("procore_to_shield"),
      v.literal("shield_to_procore"),
      v.literal("bidirectional")
    ),
    syncStatus: v.optional(v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("error")
    )),
    syncError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("procoreMappings")
      .withIndex("by_procore", (q) =>
        q
          .eq("procoreCompanyId", args.procoreCompanyId)
          .eq("procoreEntityType", args.procoreEntityType)
          .eq("procoreEntityId", args.procoreEntityId)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        shieldEntityId: args.shieldEntityId,
        syncDirection: args.syncDirection,
        syncStatus: args.syncStatus || existing.syncStatus,
        syncError: args.syncError,
        lastSyncedAt: Date.now(),
        updatedAt: Date.now(),
      })
      return existing._id
    }

    return await ctx.db.insert("procoreMappings", {
      companyId: args.companyId,
      procoreCompanyId: args.procoreCompanyId,
      procoreEntityType: args.procoreEntityType,
      procoreEntityId: args.procoreEntityId,
      shieldEntityType: args.shieldEntityType,
      shieldEntityId: args.shieldEntityId,
      syncDirection: args.syncDirection,
      syncStatus: args.syncStatus || "active",
      syncError: args.syncError,
      lastSyncedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// Delete Procore mapping
export const deleteProcoreMapping = mutation({
  args: { id: v.id("procoreMappings") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

// ========== Procore Sync Log ==========

// Create sync log entry
export const createSyncLog = mutation({
  args: {
    companyId: v.id("companies"),
    procoreCompanyId: v.number(),
    syncType: v.union(
      v.literal("projects"),
      v.literal("vendors"),
      v.literal("compliance_push")
    ),
    status: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("failed")
    ),
    totalItems: v.optional(v.number()),
    createdCount: v.optional(v.number()),
    updatedCount: v.optional(v.number()),
    skippedCount: v.optional(v.number()),
    errorCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("procoreSyncLog", {
      companyId: args.companyId,
      procoreCompanyId: args.procoreCompanyId,
      syncType: args.syncType,
      status: args.status,
      totalItems: args.totalItems,
      createdCount: args.createdCount,
      updatedCount: args.updatedCount,
      skippedCount: args.skippedCount,
      errorCount: args.errorCount,
      errorMessage: args.errorMessage,
      startedAt: Date.now(),
    })
  },
})

// Update sync log entry
export const updateSyncLog = mutation({
  args: {
    id: v.id("procoreSyncLog"),
    status: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("failed")
    ),
    totalItems: v.optional(v.number()),
    createdCount: v.optional(v.number()),
    updatedCount: v.optional(v.number()),
    skippedCount: v.optional(v.number()),
    errorCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args

    const log = await ctx.db.get(id)
    if (!log) {
      throw new Error("Sync log not found")
    }

    const durationMs = Date.now() - log.startedAt

    await ctx.db.patch(id, {
      ...updates,
      completedAt: Date.now(),
      durationMs,
    })
  },
})

// Get recent sync logs for a company
export const getRecentSyncLogs = query({
  args: {
    companyId: v.id("companies"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("procoreSyncLog")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(args.limit || 20)
  },
})
