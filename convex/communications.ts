import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Communication type validator
const communicationType = v.union(
  v.literal("deficiency"),
  v.literal("follow_up"),
  v.literal("confirmation"),
  v.literal("expiration_reminder"),
  v.literal("critical_alert")
)

// Communication channel validator
const communicationChannel = v.union(
  v.literal("email"),
  v.literal("sms")
)

// Communication status validator
const communicationStatus = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("opened"),
  v.literal("failed")
)

// Get communication by ID
export const getById = query({
  args: { id: v.id("communications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get communications by subcontractor
export const getBySubcontractor = query({
  args: { subcontractorId: v.id("subcontractors") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("communications")
      .withIndex("by_subcontractor", (q) => q.eq("subcontractorId", args.subcontractorId))
      .order("desc")
      .collect()
  },
})

// Get communications by project
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("communications")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect()
  },
})

// Get communications by status
export const getByStatus = query({
  args: { status: communicationStatus },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("communications")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect()
  },
})

// Create communication
export const create = mutation({
  args: {
    subcontractorId: v.id("subcontractors"),
    projectId: v.id("projects"),
    verificationId: v.optional(v.id("verifications")),
    type: communicationType,
    channel: communicationChannel,
    recipientEmail: v.optional(v.string()),
    ccEmails: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    status: communicationStatus,
    sentAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const communicationId = await ctx.db.insert("communications", {
      subcontractorId: args.subcontractorId,
      projectId: args.projectId,
      verificationId: args.verificationId,
      type: args.type,
      channel: args.channel,
      recipientEmail: args.recipientEmail?.toLowerCase(),
      ccEmails: args.ccEmails,
      subject: args.subject,
      body: args.body,
      status: args.status,
      sentAt: args.sentAt,
      deliveredAt: undefined,
      openedAt: undefined,
      updatedAt: Date.now(),
    })
    return communicationId
  },
})

// Update communication status
export const updateStatus = mutation({
  args: {
    id: v.id("communications"),
    status: communicationStatus,
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
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
  },
})

// Delete communication
export const remove = mutation({
  args: { id: v.id("communications") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

// Get communications by subcontractor with project details
export const getBySubcontractorWithDetails = query({
  args: { subcontractorId: v.id("subcontractors") },
  handler: async (ctx, args) => {
    const communications = await ctx.db
      .query("communications")
      .withIndex("by_subcontractor", (q) => q.eq("subcontractorId", args.subcontractorId))
      .order("desc")
      .collect()

    // Get project details for each communication
    const results = await Promise.all(
      communications.map(async (comm) => {
        const project = await ctx.db.get(comm.projectId)
        return {
          ...comm,
          projectName: project?.name || null,
        }
      })
    )

    return results
  },
})

// List communications by company with subcontractor and project details
export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get all projects for this company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const projectIds = new Set(projects.map((p) => p._id))
    const projectMap = new Map(projects.map((p) => [p._id, p.name]))

    // Get communications for these projects
    const allComms = []
    for (const projectId of Array.from(projectIds)) {
      const comms = await ctx.db
        .query("communications")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .order("desc")
        .collect()
      allComms.push(...comms)
    }

    // Sort by creation time descending and limit
    allComms.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0))
    const limited = args.limit ? allComms.slice(0, args.limit) : allComms.slice(0, 100)

    // Enrich with subcontractor and project names
    const results = await Promise.all(
      limited.map(async (comm) => {
        const subcontractor = await ctx.db.get(comm.subcontractorId)
        return {
          ...comm,
          subcontractor_name: subcontractor?.name || null,
          project_name: projectMap.get(comm.projectId) || null,
        }
      })
    )

    return results
  },
})

// Find recent communications by recipient email
export const getRecentByRecipientEmail = query({
  args: {
    recipientEmail: v.string(),
    statuses: v.array(v.string()),
    daysBack: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysBack = args.daysBack || 7
    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000

    // Query all communications and filter by email and time
    // Since we don't have an index on recipientEmail, we need to scan
    const allComms = await ctx.db.query("communications").collect()

    const filtered = allComms.filter((comm) => {
      if (comm.recipientEmail?.toLowerCase() !== args.recipientEmail.toLowerCase()) return false
      if (!args.statuses.includes(comm.status)) return false
      if (!comm.sentAt || comm.sentAt < cutoffTime) return false
      return true
    })

    // Sort by sentAt descending
    filtered.sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))

    return filtered.slice(0, args.limit || 5)
  },
})

// Update communication from webhook event
export const updateFromWebhook = mutation({
  args: {
    id: v.id("communications"),
    status: communicationStatus,
    deliveredAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const comm = await ctx.db.get(args.id)
    if (!comm) throw new Error("Communication not found")

    // Status priority - only update if new status is higher or it's a failure
    const statusPriority: Record<string, number> = {
      pending: 0,
      sent: 1,
      delivered: 2,
      opened: 3,
      failed: -1, // Special case
    }

    const currentPriority = statusPriority[comm.status] ?? 0
    const newPriority = statusPriority[args.status] ?? 0

    // Only update if new status is higher priority or if it's a failure
    if (args.status === "failed" || newPriority > currentPriority) {
      await ctx.db.patch(args.id, {
        status: args.status,
        deliveredAt: args.deliveredAt || comm.deliveredAt,
        openedAt: args.openedAt || comm.openedAt,
        updatedAt: Date.now(),
      })
      return { updated: true, previousStatus: comm.status, newStatus: args.status }
    }

    return { updated: false, previousStatus: comm.status, newStatus: args.status }
  },
})
