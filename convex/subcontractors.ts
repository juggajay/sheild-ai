import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Get subcontractor by ID
export const getById = query({
  args: { id: v.id("subcontractors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get subcontractors by company
export const getByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subcontractors")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()
  },
})

// Get subcontractor by ABN within company
export const getByAbn = query({
  args: {
    companyId: v.id("companies"),
    abn: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subcontractors")
      .withIndex("by_abn", (q) =>
        q.eq("companyId", args.companyId).eq("abn", args.abn)
      )
      .first()
  },
})

// Search subcontractors by name
export const searchByName = query({
  args: {
    companyId: v.id("companies"),
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.searchTerm.trim()) {
      return await ctx.db
        .query("subcontractors")
        .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
        .take(100)
    }

    return await ctx.db
      .query("subcontractors")
      .withSearchIndex("search_name", (q) =>
        q.search("name", args.searchTerm).eq("companyId", args.companyId)
      )
      .take(100)
  },
})

// Create subcontractor
export const create = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    abn: v.string(),
    acn: v.optional(v.string()),
    tradingName: v.optional(v.string()),
    address: v.optional(v.string()),
    trade: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    brokerName: v.optional(v.string()),
    brokerEmail: v.optional(v.string()),
    brokerPhone: v.optional(v.string()),
    workersCompState: v.optional(v.string()),
    portalAccess: v.optional(v.boolean()),
    portalUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Check if subcontractor with same ABN exists in this company
    const existingByAbn = await ctx.db
      .query("subcontractors")
      .withIndex("by_abn", (q) =>
        q.eq("companyId", args.companyId).eq("abn", args.abn)
      )
      .first()

    if (existingByAbn) {
      throw new Error("Subcontractor with this ABN already exists")
    }

    const subcontractorId = await ctx.db.insert("subcontractors", {
      companyId: args.companyId,
      name: args.name,
      abn: args.abn,
      acn: args.acn,
      tradingName: args.tradingName,
      address: args.address,
      trade: args.trade,
      contactName: args.contactName,
      contactEmail: args.contactEmail?.toLowerCase(),
      contactPhone: args.contactPhone,
      brokerName: args.brokerName,
      brokerEmail: args.brokerEmail?.toLowerCase(),
      brokerPhone: args.brokerPhone,
      workersCompState: args.workersCompState,
      portalAccess: args.portalAccess || false,
      portalUserId: args.portalUserId,
      updatedAt: Date.now(),
    })

    return subcontractorId
  },
})

// Update subcontractor
export const update = mutation({
  args: {
    id: v.id("subcontractors"),
    name: v.optional(v.string()),
    abn: v.optional(v.string()),
    acn: v.optional(v.string()),
    tradingName: v.optional(v.string()),
    address: v.optional(v.string()),
    trade: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    brokerName: v.optional(v.string()),
    brokerEmail: v.optional(v.string()),
    brokerPhone: v.optional(v.string()),
    workersCompState: v.optional(v.string()),
    portalAccess: v.optional(v.boolean()),
    portalUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args

    const subcontractor = await ctx.db.get(id)
    if (!subcontractor) throw new Error("Subcontractor not found")

    // If updating ABN, check it's not already in use
    if (updates.abn && updates.abn !== subcontractor.abn) {
      const existingByAbn = await ctx.db
        .query("subcontractors")
        .withIndex("by_abn", (q) =>
          q.eq("companyId", subcontractor.companyId).eq("abn", updates.abn!)
        )
        .first()

      if (existingByAbn && existingByAbn._id !== id) {
        throw new Error("Subcontractor with this ABN already exists")
      }
    }

    // Normalize emails
    if (updates.contactEmail) {
      updates.contactEmail = updates.contactEmail.toLowerCase()
    }
    if (updates.brokerEmail) {
      updates.brokerEmail = updates.brokerEmail.toLowerCase()
    }

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

// Delete subcontractor
export const remove = mutation({
  args: { id: v.id("subcontractors") },
  handler: async (ctx, args) => {
    // Note: In a real app, you'd want to check for related data
    await ctx.db.delete(args.id)
  },
})

// Get subcontractor count by company
export const getCount = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const subcontractors = await ctx.db
      .query("subcontractors")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    return subcontractors.length
  },
})

// Enable/disable portal access
export const setPortalAccess = mutation({
  args: {
    id: v.id("subcontractors"),
    portalAccess: v.boolean(),
    portalUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      portalAccess: args.portalAccess,
      portalUserId: args.portalUserId,
      updatedAt: Date.now(),
    })
  },
})
