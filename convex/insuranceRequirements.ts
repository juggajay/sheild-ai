import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Coverage type validator
const coverageType = v.union(
  v.literal("public_liability"),
  v.literal("products_liability"),
  v.literal("workers_comp"),
  v.literal("professional_indemnity"),
  v.literal("motor_vehicle"),
  v.literal("contract_works")
)

// Get insurance requirements by project
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("insuranceRequirements")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()
  },
})

// Get insurance requirement by ID
export const getById = query({
  args: { id: v.id("insuranceRequirements") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get insurance requirement by project and coverage type
export const getByProjectAndCoverageType = query({
  args: {
    projectId: v.id("projects"),
    coverageType: coverageType,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("insuranceRequirements")
      .withIndex("by_coverage_type", (q) =>
        q.eq("projectId", args.projectId).eq("coverageType", args.coverageType)
      )
      .first()
  },
})

// Create insurance requirement
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    coverageType: coverageType,
    minimumLimit: v.optional(v.number()),
    limitType: v.optional(v.string()),
    maximumExcess: v.optional(v.number()),
    principalIndemnityRequired: v.boolean(),
    crossLiabilityRequired: v.boolean(),
    waiverOfSubrogationRequired: v.boolean(),
    principalNamingRequired: v.optional(v.string()),
    otherRequirements: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if this coverage type already exists for the project
    const existing = await ctx.db
      .query("insuranceRequirements")
      .withIndex("by_coverage_type", (q) =>
        q.eq("projectId", args.projectId).eq("coverageType", args.coverageType)
      )
      .first()

    if (existing) {
      throw new Error("This coverage type already exists for this project")
    }

    const requirementId = await ctx.db.insert("insuranceRequirements", {
      projectId: args.projectId,
      coverageType: args.coverageType,
      minimumLimit: args.minimumLimit,
      limitType: args.limitType || "per_occurrence",
      maximumExcess: args.maximumExcess,
      principalIndemnityRequired: args.principalIndemnityRequired,
      crossLiabilityRequired: args.crossLiabilityRequired,
      waiverOfSubrogationRequired: args.waiverOfSubrogationRequired,
      principalNamingRequired: args.principalNamingRequired,
      otherRequirements: args.otherRequirements,
      updatedAt: Date.now(),
    })

    return requirementId
  },
})

// Update insurance requirement
export const update = mutation({
  args: {
    id: v.id("insuranceRequirements"),
    minimumLimit: v.optional(v.number()),
    limitType: v.optional(v.string()),
    maximumExcess: v.optional(v.number()),
    principalIndemnityRequired: v.optional(v.boolean()),
    crossLiabilityRequired: v.optional(v.boolean()),
    waiverOfSubrogationRequired: v.optional(v.boolean()),
    principalNamingRequired: v.optional(v.string()),
    otherRequirements: v.optional(v.string()),
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

// Delete insurance requirement
export const remove = mutation({
  args: { id: v.id("insuranceRequirements") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

// Delete all insurance requirements for a project
export const removeByProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const requirements = await ctx.db
      .query("insuranceRequirements")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    for (const req of requirements) {
      await ctx.db.delete(req._id)
    }

    return requirements.length
  },
})

// Bulk replace insurance requirements for a project
export const bulkReplace = mutation({
  args: {
    projectId: v.id("projects"),
    requirements: v.array(
      v.object({
        coverageType: coverageType,
        minimumLimit: v.optional(v.number()),
        limitType: v.optional(v.string()),
        maximumExcess: v.optional(v.number()),
        principalIndemnityRequired: v.boolean(),
        crossLiabilityRequired: v.boolean(),
        waiverOfSubrogationRequired: v.boolean(),
        principalNamingRequired: v.optional(v.string()),
        otherRequirements: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Delete existing requirements
    const existing = await ctx.db
      .query("insuranceRequirements")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    for (const req of existing) {
      await ctx.db.delete(req._id)
    }

    // Insert new requirements
    const newIds: Id<"insuranceRequirements">[] = []
    for (const req of args.requirements) {
      const id = await ctx.db.insert("insuranceRequirements", {
        projectId: args.projectId,
        coverageType: req.coverageType,
        minimumLimit: req.minimumLimit,
        limitType: req.limitType || "per_occurrence",
        maximumExcess: req.maximumExcess,
        principalIndemnityRequired: req.principalIndemnityRequired,
        crossLiabilityRequired: req.crossLiabilityRequired,
        waiverOfSubrogationRequired: req.waiverOfSubrogationRequired,
        principalNamingRequired: req.principalNamingRequired,
        otherRequirements: req.otherRequirements,
        updatedAt: Date.now(),
      })
      newIds.push(id)
    }

    return newIds
  },
})
