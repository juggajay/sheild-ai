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

// Get paginated projects with subcontractor counts (role-based)
export const listPaginated = query({
  args: {
    companyId: v.id("companies"),
    userId: v.optional(v.id("users")),
    userRole: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20
    const includeArchived = args.includeArchived || false
    const isFullAccess = ['admin', 'risk_manager', 'read_only'].includes(args.userRole || '')

    // Get all projects for the company
    let allProjects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    // Filter by status if not including archived
    if (!includeArchived) {
      allProjects = allProjects.filter(p => p.status !== "completed")
    }

    // Filter by project manager if not full access
    if (!isFullAccess && args.userId) {
      allProjects = allProjects.filter(p => p.projectManagerId === args.userId)
    }

    const total = allProjects.length

    // Sort by creation time descending
    allProjects.sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))

    // Simple offset-based pagination
    const offset = args.cursor ? parseInt(args.cursor) : 0
    const paginatedProjects = allProjects.slice(offset, offset + limit)

    // Get project manager names and subcontractor counts
    const results = await Promise.all(
      paginatedProjects.map(async (project) => {
        // Get project manager
        let projectManagerName = null
        if (project.projectManagerId) {
          const manager = await ctx.db.get(project.projectManagerId)
          projectManagerName = manager?.name || null
        }

        // Get subcontractor counts
        const projectSubcontractors = await ctx.db
          .query("projectSubcontractors")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect()

        const subcontractorCount = projectSubcontractors.length
        const compliantCount = projectSubcontractors.filter(ps => ps.status === "compliant").length

        return {
          ...project,
          project_manager_name: projectManagerName,
          subcontractor_count: subcontractorCount,
          compliant_count: compliantCount,
        }
      })
    )

    // Next cursor
    const hasMore = offset + limit < total
    const nextCursor = hasMore ? String(offset + limit) : null

    return {
      projects: results,
      total,
      nextCursor,
      hasMore,
    }
  },
})

// Get project by ID with full details
export const getByIdWithDetails = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id)
    if (!project) return null

    // Get project manager
    let projectManager = null
    if (project.projectManagerId) {
      const manager = await ctx.db.get(project.projectManagerId)
      if (manager) {
        projectManager = {
          id: manager._id,
          name: manager.name,
          email: manager.email,
        }
      }
    }

    // Get subcontractor counts
    const projectSubcontractors = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect()

    const counts = {
      total: projectSubcontractors.length,
      compliant: projectSubcontractors.filter(ps => ps.status === "compliant").length,
      non_compliant: projectSubcontractors.filter(ps => ps.status === "non_compliant").length,
      pending: projectSubcontractors.filter(ps => ps.status === "pending").length,
      exception: projectSubcontractors.filter(ps => ps.status === "exception").length,
    }

    // Get insurance requirements
    const requirements = await ctx.db
      .query("insuranceRequirements")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect()

    return {
      project: {
        ...project,
        project_manager: projectManager,
        counts,
        requirements,
      },
    }
  },
})

// Get project by ID with company validation
export const getByIdForCompany = query({
  args: {
    id: v.id("projects"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id)
    if (!project) return null
    if (project.companyId !== args.companyId) return null

    return {
      ...project,
      project_manager_id: project.projectManagerId,
    }
  },
})

// Validate user can access project
export const validateAccess = query({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    userRole: v.string(),
    userCompanyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId)
    if (!project) return { canAccess: false, project: null }

    // Must be same company
    if (project.companyId !== args.userCompanyId) {
      return { canAccess: false, project: null }
    }

    // Admin, risk_manager, read_only can access all company projects
    if (['admin', 'risk_manager', 'read_only'].includes(args.userRole)) {
      return { canAccess: true, project }
    }

    // Project manager and project administrator can only access assigned projects
    if (['project_manager', 'project_administrator'].includes(args.userRole)) {
      return { canAccess: project.projectManagerId === args.userId, project }
    }

    return { canAccess: false, project: null }
  },
})

// Validate project manager exists in company
export const validateProjectManager = query({
  args: {
    projectManagerId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.projectManagerId)
    if (!user) return false
    return user.companyId === args.companyId
  },
})

// Get project report data (for PDF generation)
export const getReportData = query({
  args: {
    projectId: v.id("projects"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    // Get project with company
    const project = await ctx.db.get(args.projectId)
    if (!project) return null
    if (project.companyId !== args.companyId) return null

    const company = await ctx.db.get(project.companyId)
    if (!company) return null

    // Get insurance requirements
    const requirements = await ctx.db
      .query("insuranceRequirements")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    // Get project subcontractors with details
    const projectSubcontractors = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    // Build subcontractor compliance data
    const subcontractors = await Promise.all(
      projectSubcontractors.map(async (ps) => {
        const subcontractor = await ctx.db.get(ps.subcontractorId)
        if (!subcontractor) return null

        // Get latest document status
        const latestDoc = await ctx.db
          .query("cocDocuments")
          .withIndex("by_subcontractor_project", (q) =>
            q.eq("subcontractorId", ps.subcontractorId).eq("projectId", args.projectId)
          )
          .order("desc")
          .first()

        let latestDocumentStatus = null
        let deficiencyCount = 0

        if (latestDoc) {
          const verification = await ctx.db
            .query("verifications")
            .withIndex("by_document", (q) => q.eq("cocDocumentId", latestDoc._id))
            .first()

          if (verification) {
            latestDocumentStatus = verification.status
            if (verification.deficiencies && Array.isArray(verification.deficiencies)) {
              deficiencyCount = verification.deficiencies.length
            }
          }
        }

        return {
          id: subcontractor._id,
          name: subcontractor.name,
          abn: subcontractor.abn,
          trade: subcontractor.trade,
          status: ps.status,
          on_site_date: ps.onSiteDate,
          latest_document_status: latestDocumentStatus,
          deficiency_count: deficiencyCount,
        }
      })
    )

    // Filter out nulls
    const validSubcontractors = subcontractors.filter((s) => s !== null)

    return {
      project: {
        id: project._id,
        name: project.name,
        address: project.address,
        state: project.state,
        status: project.status,
        start_date: project.startDate,
        end_date: project.endDate,
        estimated_value: project.estimatedValue,
        forwarding_email: project.forwardingEmail,
        company_name: company.name,
      },
      requirements: requirements.map((r) => ({
        coverage_type: r.coverageType,
        minimum_limit: r.minimumLimit,
        maximum_excess: r.maximumExcess,
      })),
      subcontractors: validSubcontractors,
    }
  },
})
