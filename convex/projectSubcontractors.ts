import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Compliance status type validator
const complianceStatus = v.union(
  v.literal("pending"),
  v.literal("compliant"),
  v.literal("non_compliant"),
  v.literal("exception")
)

// Get project-subcontractor link by ID
export const getById = query({
  args: { id: v.id("projectSubcontractors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get project-subcontractor link with full data
export const getByIdWithDetails = query({
  args: { id: v.id("projectSubcontractors") },
  handler: async (ctx, args) => {
    const ps = await ctx.db.get(args.id)
    if (!ps) return null

    const [project, subcontractor] = await Promise.all([
      ctx.db.get(ps.projectId),
      ctx.db.get(ps.subcontractorId),
    ])

    return {
      ...ps,
      project,
      subcontractor,
    }
  },
})

// Get all subcontractors for a project
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    // Get subcontractor details for each link
    const results = await Promise.all(
      links.map(async (link) => {
        const subcontractor = await ctx.db.get(link.subcontractorId)
        return {
          ...link,
          subcontractor,
        }
      })
    )

    return results
  },
})

// Get all projects for a subcontractor
export const getBySubcontractor = query({
  args: { subcontractorId: v.id("subcontractors") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_subcontractor", (q) => q.eq("subcontractorId", args.subcontractorId))
      .collect()

    // Get project details for each link
    const results = await Promise.all(
      links.map(async (link) => {
        const project = await ctx.db.get(link.projectId)
        return {
          ...link,
          project,
        }
      })
    )

    return results
  },
})

// Get specific project-subcontractor link
export const getByProjectAndSubcontractor = query({
  args: {
    projectId: v.id("projects"),
    subcontractorId: v.id("subcontractors"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project_subcontractor", (q) =>
        q.eq("projectId", args.projectId).eq("subcontractorId", args.subcontractorId)
      )
      .first()
  },
})

// Get subcontractors by project and status
export const getByProjectAndStatus = query({
  args: {
    projectId: v.id("projects"),
    status: complianceStatus,
  },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", args.status)
      )
      .collect()

    // Get subcontractor details
    const results = await Promise.all(
      links.map(async (link) => {
        const subcontractor = await ctx.db.get(link.subcontractorId)
        return {
          ...link,
          subcontractor,
        }
      })
    )

    return results
  },
})

// Create project-subcontractor link
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    subcontractorId: v.id("subcontractors"),
    status: v.optional(complianceStatus),
    onSiteDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if link already exists
    const existing = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project_subcontractor", (q) =>
        q.eq("projectId", args.projectId).eq("subcontractorId", args.subcontractorId)
      )
      .first()

    if (existing) {
      throw new Error("Subcontractor already assigned to this project")
    }

    const linkId = await ctx.db.insert("projectSubcontractors", {
      projectId: args.projectId,
      subcontractorId: args.subcontractorId,
      status: args.status || "pending",
      onSiteDate: args.onSiteDate,
      updatedAt: Date.now(),
    })

    return linkId
  },
})

// Update project-subcontractor link
export const update = mutation({
  args: {
    id: v.id("projectSubcontractors"),
    status: v.optional(complianceStatus),
    onSiteDate: v.optional(v.number()),
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

// Update compliance status by ID
export const updateStatus = mutation({
  args: {
    id: v.id("projectSubcontractors"),
    status: complianceStatus,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    })
  },
})

// Update compliance status by project and subcontractor
export const updateStatusByProjectAndSubcontractor = mutation({
  args: {
    projectId: v.id("projects"),
    subcontractorId: v.id("subcontractors"),
    status: complianceStatus,
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project_subcontractor", (q) =>
        q.eq("projectId", args.projectId).eq("subcontractorId", args.subcontractorId)
      )
      .first()

    if (!link) {
      throw new Error("Project-subcontractor link not found")
    }

    await ctx.db.patch(link._id, {
      status: args.status,
      updatedAt: Date.now(),
    })

    return link._id
  },
})

// Delete project-subcontractor link
export const remove = mutation({
  args: { id: v.id("projectSubcontractors") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

// Remove subcontractor from project
export const removeByProjectAndSubcontractor = mutation({
  args: {
    projectId: v.id("projects"),
    subcontractorId: v.id("subcontractors"),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project_subcontractor", (q) =>
        q.eq("projectId", args.projectId).eq("subcontractorId", args.subcontractorId)
      )
      .first()

    if (link) {
      await ctx.db.delete(link._id)
    }
  },
})

// Get compliance stats for a project
export const getComplianceStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    const stats = {
      total: links.length,
      compliant: links.filter((l) => l.status === "compliant").length,
      nonCompliant: links.filter((l) => l.status === "non_compliant").length,
      pending: links.filter((l) => l.status === "pending").length,
      exception: links.filter((l) => l.status === "exception").length,
    }

    stats.total > 0
      ? (stats as any).complianceRate = Math.round(
          ((stats.compliant + stats.exception) / stats.total) * 100
        )
      : (stats as any).complianceRate = 0

    return stats
  },
})

// Get company-wide compliance stats
export const getCompanyComplianceStats = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // Get all active projects for the company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .collect()

    let totalCompliant = 0
    let totalNonCompliant = 0
    let totalPending = 0
    let totalException = 0

    // Get compliance stats for each project
    for (const project of projects) {
      const links = await ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      totalCompliant += links.filter((l) => l.status === "compliant").length
      totalNonCompliant += links.filter((l) => l.status === "non_compliant").length
      totalPending += links.filter((l) => l.status === "pending").length
      totalException += links.filter((l) => l.status === "exception").length
    }

    const total = totalCompliant + totalNonCompliant + totalPending + totalException

    return {
      total,
      compliant: totalCompliant,
      nonCompliant: totalNonCompliant,
      pending: totalPending,
      exception: totalException,
      complianceRate: total > 0
        ? Math.round(((totalCompliant + totalException) / total) * 100)
        : 0,
    }
  },
})

// Get project subcontractors with full details (for project subcontractors list)
export const getByProjectWithDetails = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    // Get subcontractor details for each link
    const results = await Promise.all(
      links.map(async (link) => {
        const subcontractor = await ctx.db.get(link.subcontractorId)
        if (!subcontractor) return null

        return {
          project_subcontractor_id: link._id,
          status: link.status,
          on_site_date: link.onSiteDate,
          assigned_at: link._creationTime,
          // Subcontractor details
          id: subcontractor._id,
          name: subcontractor.name,
          abn: subcontractor.abn,
          acn: subcontractor.acn,
          tradingName: subcontractor.tradingName,
          address: subcontractor.address,
          trade: subcontractor.trade,
          contactName: subcontractor.contactName,
          contactEmail: subcontractor.contactEmail,
          contactPhone: subcontractor.contactPhone,
          brokerName: subcontractor.brokerName,
          brokerEmail: subcontractor.brokerEmail,
          brokerPhone: subcontractor.brokerPhone,
          workersCompState: subcontractor.workersCompState,
          portalAccess: subcontractor.portalAccess,
        }
      })
    )

    // Filter out nulls and sort by name
    const filteredResults = results.filter((r) => r !== null)
    filteredResults.sort((a, b) => a!.name.localeCompare(b!.name))

    return {
      subcontractors: filteredResults,
      total: filteredResults.length,
    }
  },
})

// Validate subcontractor belongs to company
export const validateSubcontractor = query({
  args: {
    subcontractorId: v.id("subcontractors"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const subcontractor = await ctx.db.get(args.subcontractorId)
    if (!subcontractor) return { valid: false, subcontractor: null }
    if (subcontractor.companyId !== args.companyId) return { valid: false, subcontractor: null }
    return { valid: true, subcontractor }
  },
})

// Get project-subcontractor link with project details for access control
export const getByIdWithProject = query({
  args: { id: v.id("projectSubcontractors") },
  handler: async (ctx, args) => {
    const ps = await ctx.db.get(args.id)
    if (!ps) return null

    const project = await ctx.db.get(ps.projectId)
    if (!project) return null

    return {
      ...ps,
      companyId: project.companyId,
      projectManagerId: project.projectManagerId,
      projectName: project.name,
    }
  },
})

// List all project-subcontractors for a company with role filtering
export const listByCompanyWithRoleFilter = query({
  args: {
    companyId: v.id("companies"),
    userId: v.optional(v.id("users")),
    filterByProjectManagerOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get all projects for this company
    let projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    // If filtering by project manager only, filter projects
    if (args.filterByProjectManagerOnly && args.userId) {
      projects = projects.filter((p) => p.projectManagerId === args.userId)
    }

    const projectMap = new Map(projects.map((p) => [p._id, p]))

    // Get all project-subcontractors for these projects
    const results = []
    for (const project of projects) {
      const links = await ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const link of links) {
        const subcontractor = await ctx.db.get(link.subcontractorId)
        if (!subcontractor) continue

        results.push({
          id: link._id,
          project_id: link.projectId,
          subcontractor_id: link.subcontractorId,
          status: link.status,
          on_site_date: link.onSiteDate
            ? new Date(link.onSiteDate).toISOString()
            : null,
          project_name: project.name,
          subcontractor_name: subcontractor.name,
          subcontractor_abn: subcontractor.abn,
        })
      }
    }

    // Sort by project name, then subcontractor name
    results.sort((a, b) => {
      const projectCompare = a.project_name.localeCompare(b.project_name)
      if (projectCompare !== 0) return projectCompare
      return a.subcontractor_name.localeCompare(b.subcontractor_name)
    })

    return results
  },
})
