import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Australian state type validator
const australianState = v.union(
  v.literal("NSW"),
  v.literal("VIC"),
  v.literal("QLD"),
  v.literal("WA"),
  v.literal("SA"),
  v.literal("TAS"),
  v.literal("NT"),
  v.literal("ACT")
)

// Project status type validator
const projectStatus = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("on_hold")
)

// Get project by ID
export const getById = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get project by ID with company data
export const getByIdWithCompany = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id)
    if (!project) return null

    const company = await ctx.db.get(project.companyId)
    return { ...project, company }
  },
})

// Get projects by company
export const getByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .collect()
  },
})

// Get projects by company and status
export const getByCompanyAndStatus = query({
  args: {
    companyId: v.id("companies"),
    status: projectStatus,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", args.status)
      )
      .collect()
  },
})

// Get active projects by company
export const getActiveByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .collect()
  },
})

// Get projects by project manager
export const getByManager = query({
  args: { projectManagerId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_manager", (q) => q.eq("projectManagerId", args.projectManagerId))
      .collect()
  },
})

// Get project by forwarding email
export const getByForwardingEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_forwarding_email", (q) => q.eq("forwardingEmail", args.email.toLowerCase()))
      .first()
  },
})

// Create project
export const create = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    address: v.optional(v.string()),
    state: v.optional(australianState),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    estimatedValue: v.optional(v.number()),
    projectManagerId: v.optional(v.id("users")),
    forwardingEmail: v.optional(v.string()),
    status: v.optional(projectStatus),
  },
  handler: async (ctx, args) => {
    // Check if forwarding email is already in use
    if (args.forwardingEmail) {
      const existingByEmail = await ctx.db
        .query("projects")
        .withIndex("by_forwarding_email", (q) => q.eq("forwardingEmail", args.forwardingEmail!.toLowerCase()))
        .first()

      if (existingByEmail) {
        throw new Error("Forwarding email already in use")
      }
    }

    const projectId = await ctx.db.insert("projects", {
      companyId: args.companyId,
      name: args.name,
      address: args.address,
      state: args.state,
      startDate: args.startDate,
      endDate: args.endDate,
      estimatedValue: args.estimatedValue,
      projectManagerId: args.projectManagerId,
      forwardingEmail: args.forwardingEmail?.toLowerCase(),
      status: args.status || "active",
      updatedAt: Date.now(),
    })

    return projectId
  },
})

// Update project
export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    state: v.optional(australianState),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    estimatedValue: v.optional(v.number()),
    projectManagerId: v.optional(v.id("users")),
    forwardingEmail: v.optional(v.string()),
    status: v.optional(projectStatus),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args

    // If updating forwarding email, check it's not already in use
    if (updates.forwardingEmail) {
      const existingByEmail = await ctx.db
        .query("projects")
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

// Delete project
export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    // Note: In a real app, you'd want to cascade delete related data
    await ctx.db.delete(args.id)
  },
})

// Get project stats for dashboard
export const getStats = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const stats = {
      total: projects.length,
      active: projects.filter((p) => p.status === "active").length,
      completed: projects.filter((p) => p.status === "completed").length,
      onHold: projects.filter((p) => p.status === "on_hold").length,
    }

    return stats
  },
})
