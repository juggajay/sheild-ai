import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Get company by ID
export const getById = query({
  args: { id: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get company by ABN
export const getByAbn = query({
  args: { abn: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_abn", (q) => q.eq("abn", args.abn))
      .first()
  },
})

// Get company by forwarding email
export const getByForwardingEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_forwarding_email", (q) => q.eq("forwardingEmail", args.email.toLowerCase()))
      .first()
  },
})

// Create company
export const create = mutation({
  args: {
    name: v.string(),
    abn: v.string(),
    acn: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    address: v.optional(v.string()),
    primaryContactName: v.optional(v.string()),
    primaryContactEmail: v.optional(v.string()),
    primaryContactPhone: v.optional(v.string()),
    forwardingEmail: v.optional(v.string()),
    settings: v.optional(v.any()),
    subscriptionTier: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if ABN already exists
    const existingByAbn = await ctx.db
      .query("companies")
      .withIndex("by_abn", (q) => q.eq("abn", args.abn))
      .first()

    if (existingByAbn) {
      throw new Error("Company with this ABN already exists")
    }

    // Check if forwarding email already exists
    if (args.forwardingEmail) {
      const existingByEmail = await ctx.db
        .query("companies")
        .withIndex("by_forwarding_email", (q) => q.eq("forwardingEmail", args.forwardingEmail!.toLowerCase()))
        .first()

      if (existingByEmail) {
        throw new Error("Forwarding email already in use")
      }
    }

    const companyId = await ctx.db.insert("companies", {
      name: args.name,
      abn: args.abn,
      acn: args.acn,
      logoUrl: args.logoUrl,
      address: args.address,
      primaryContactName: args.primaryContactName,
      primaryContactEmail: args.primaryContactEmail,
      primaryContactPhone: args.primaryContactPhone,
      forwardingEmail: args.forwardingEmail?.toLowerCase(),
      settings: args.settings || {},
      subscriptionTier: args.subscriptionTier || "trial",
      subscriptionStatus: args.subscriptionStatus || "active",
      updatedAt: Date.now(),
    })

    return companyId
  },
})

// Update company
export const update = mutation({
  args: {
    id: v.id("companies"),
    name: v.optional(v.string()),
    abn: v.optional(v.string()),
    acn: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    address: v.optional(v.string()),
    primaryContactName: v.optional(v.string()),
    primaryContactEmail: v.optional(v.string()),
    primaryContactPhone: v.optional(v.string()),
    forwardingEmail: v.optional(v.string()),
    settings: v.optional(v.any()),
    subscriptionTier: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args

    // If updating ABN, check it's not already in use
    if (updates.abn) {
      const existingByAbn = await ctx.db
        .query("companies")
        .withIndex("by_abn", (q) => q.eq("abn", updates.abn!))
        .first()

      if (existingByAbn && existingByAbn._id !== id) {
        throw new Error("Company with this ABN already exists")
      }
    }

    // If updating forwarding email, check it's not already in use
    if (updates.forwardingEmail) {
      const existingByEmail = await ctx.db
        .query("companies")
        .withIndex("by_forwarding_email", (q) => q.eq("forwardingEmail", updates.forwardingEmail!.toLowerCase()))
        .first()

      if (existingByEmail && existingByEmail._id !== id) {
        throw new Error("Forwarding email already in use")
      }
      updates.forwardingEmail = updates.forwardingEmail.toLowerCase()
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

// Delete company (with cascade)
export const remove = mutation({
  args: { id: v.id("companies") },
  handler: async (ctx, args) => {
    // Note: In a real app, you'd want to cascade delete or check for related data
    // For now, we just delete the company
    await ctx.db.delete(args.id)
  },
})

// Update company settings
export const updateSettings = mutation({
  args: {
    id: v.id("companies"),
    settings: v.any(),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.id)
    if (!company) throw new Error("Company not found")

    const mergedSettings = {
      ...(company.settings || {}),
      ...args.settings,
    }

    await ctx.db.patch(args.id, {
      settings: mergedSettings,
      updatedAt: Date.now(),
    })
  },
})

// Update subscription
export const updateSubscription = mutation({
  args: {
    id: v.id("companies"),
    subscriptionTier: v.string(),
    subscriptionStatus: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      subscriptionTier: args.subscriptionTier,
      subscriptionStatus: args.subscriptionStatus,
      updatedAt: Date.now(),
    })
  },
})
