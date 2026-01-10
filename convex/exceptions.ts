import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Exception risk level validator
const riskLevel = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high")
)

// Exception expiration type validator
const expirationType = v.union(
  v.literal("until_resolved"),
  v.literal("fixed_duration"),
  v.literal("specific_date"),
  v.literal("permanent")
)

// Exception status validator
const exceptionStatus = v.union(
  v.literal("pending_approval"),
  v.literal("active"),
  v.literal("expired"),
  v.literal("resolved"),
  v.literal("closed")
)

// Get exception by ID
export const getById = query({
  args: { id: v.id("exceptions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get exceptions by project subcontractor
export const getByProjectSubcontractor = query({
  args: { projectSubcontractorId: v.id("projectSubcontractors") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("exceptions")
      .withIndex("by_project_subcontractor", (q) => q.eq("projectSubcontractorId", args.projectSubcontractorId))
      .order("desc")
      .collect()
  },
})

// Get exceptions by status
export const getByStatus = query({
  args: { status: exceptionStatus },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("exceptions")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect()
  },
})

// Create exception
export const create = mutation({
  args: {
    projectSubcontractorId: v.id("projectSubcontractors"),
    verificationId: v.optional(v.id("verifications")),
    issueSummary: v.string(),
    reason: v.string(),
    riskLevel: riskLevel,
    createdByUserId: v.id("users"),
    expiresAt: v.optional(v.number()),
    expirationType: expirationType,
    supportingDocumentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const exceptionId = await ctx.db.insert("exceptions", {
      projectSubcontractorId: args.projectSubcontractorId,
      verificationId: args.verificationId,
      issueSummary: args.issueSummary,
      reason: args.reason,
      riskLevel: args.riskLevel,
      createdByUserId: args.createdByUserId,
      approvedByUserId: undefined,
      approvedAt: undefined,
      expiresAt: args.expiresAt,
      expirationType: args.expirationType,
      status: "pending_approval",
      resolvedAt: undefined,
      resolutionType: undefined,
      resolutionNotes: undefined,
      supportingDocumentUrl: args.supportingDocumentUrl,
      updatedAt: Date.now(),
    })
    return exceptionId
  },
})

// Approve exception
export const approve = mutation({
  args: {
    id: v.id("exceptions"),
    approvedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "active",
      approvedByUserId: args.approvedByUserId,
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// Resolve exception
export const resolve = mutation({
  args: {
    id: v.id("exceptions"),
    resolutionType: v.string(),
    resolutionNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "resolved",
      resolvedAt: Date.now(),
      resolutionType: args.resolutionType,
      resolutionNotes: args.resolutionNotes,
      updatedAt: Date.now(),
    })
  },
})

// Close exception
export const close = mutation({
  args: { id: v.id("exceptions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "closed",
      updatedAt: Date.now(),
    })
  },
})

// Expire exceptions
export const expireOld = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const activeExceptions = await ctx.db
      .query("exceptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect()

    let expiredCount = 0
    for (const exception of activeExceptions) {
      if (exception.expiresAt && exception.expiresAt < now) {
        await ctx.db.patch(exception._id, {
          status: "expired",
          updatedAt: now,
        })
        expiredCount++
      }
    }

    return expiredCount
  },
})

// Delete exception
export const remove = mutation({
  args: { id: v.id("exceptions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

// Resolve all active exceptions for a project-subcontractor by their IDs
export const resolveActiveByProjectAndSubcontractor = mutation({
  args: {
    projectId: v.id("projects"),
    subcontractorId: v.id("subcontractors"),
    resolutionType: v.string(),
    resolutionNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find the project_subcontractor link
    const projectSubcontractor = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project_subcontractor", (q) =>
        q.eq("projectId", args.projectId).eq("subcontractorId", args.subcontractorId)
      )
      .first()

    if (!projectSubcontractor) {
      return { resolved: 0 }
    }

    // Get all active exceptions for this project_subcontractor
    const activeExceptions = await ctx.db
      .query("exceptions")
      .withIndex("by_project_subcontractor", (q) =>
        q.eq("projectSubcontractorId", projectSubcontractor._id)
      )
      .collect()

    // Filter to only active status and resolve them
    const toResolve = activeExceptions.filter((e) => e.status === "active")
    const now = Date.now()

    for (const exception of toResolve) {
      await ctx.db.patch(exception._id, {
        status: "resolved",
        resolvedAt: now,
        resolutionType: args.resolutionType,
        resolutionNotes: args.resolutionNotes,
        updatedAt: now,
      })
    }

    return { resolved: toResolve.length, exceptionIds: toResolve.map((e) => e._id) }
  },
})

// Get exceptions by subcontractor (joins through projectSubcontractors)
export const getBySubcontractor = query({
  args: { subcontractorId: v.id("subcontractors") },
  handler: async (ctx, args) => {
    // Get all project_subcontractor records for this subcontractor
    const projectSubcontractors = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_subcontractor", (q) => q.eq("subcontractorId", args.subcontractorId))
      .collect()

    // Get exceptions for all those records
    const exceptions = []
    for (const ps of projectSubcontractors) {
      const psExceptions = await ctx.db
        .query("exceptions")
        .withIndex("by_project_subcontractor", (q) => q.eq("projectSubcontractorId", ps._id))
        .collect()

      // Get project details for each exception
      const project = await ctx.db.get(ps.projectId)
      for (const exc of psExceptions) {
        // Get created by user
        const createdBy = await ctx.db.get(exc.createdByUserId)
        // Get approved by user if exists
        const approvedBy = exc.approvedByUserId
          ? await ctx.db.get(exc.approvedByUserId)
          : null

        exceptions.push({
          ...exc,
          projectId: project?._id || null,
          projectName: project?.name || null,
          createdByName: createdBy?.name || null,
          approvedByName: approvedBy?.name || null,
        })
      }
    }

    // Sort by created date descending
    exceptions.sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))

    return exceptions
  },
})

// List all exceptions by company with full details
export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    filterByUserId: v.optional(v.id("users")),
    filterByProjectManagerOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get all projects for this company
    let projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    // If filtering by project manager only, filter projects
    if (args.filterByProjectManagerOnly && args.filterByUserId) {
      projects = projects.filter((p) => p.projectManagerId === args.filterByUserId)
    }

    const projectIds = new Set(projects.map((p) => p._id))
    const projectMap = new Map(projects.map((p) => [p._id, p]))

    // Get all project_subcontractors for these projects
    const allProjectSubcontractors = []
    for (const project of projects) {
      const ps = await ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()
      allProjectSubcontractors.push(...ps)
    }

    const psMap = new Map(allProjectSubcontractors.map((ps) => [ps._id, ps]))

    // Get all exceptions for these project_subcontractors
    const allExceptions = []
    for (const ps of allProjectSubcontractors) {
      const exceptions = await ctx.db
        .query("exceptions")
        .withIndex("by_project_subcontractor", (q) => q.eq("projectSubcontractorId", ps._id))
        .collect()
      allExceptions.push(...exceptions)
    }

    // Sort by creation time descending
    allExceptions.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0))

    // Enrich with details
    const results = await Promise.all(
      allExceptions.map(async (exc) => {
        const ps = psMap.get(exc.projectSubcontractorId)
        const project = ps ? projectMap.get(ps.projectId) : null
        const subcontractor = ps ? await ctx.db.get(ps.subcontractorId) : null
        const createdBy = await ctx.db.get(exc.createdByUserId)
        const approvedBy = exc.approvedByUserId ? await ctx.db.get(exc.approvedByUserId) : null

        return {
          id: exc._id,
          project_subcontractor_id: exc.projectSubcontractorId,
          verification_id: exc.verificationId || null,
          issue_summary: exc.issueSummary,
          reason: exc.reason,
          risk_level: exc.riskLevel,
          created_by_user_id: exc.createdByUserId,
          approved_by_user_id: exc.approvedByUserId || null,
          approved_at: exc.approvedAt ? new Date(exc.approvedAt).toISOString() : null,
          expires_at: exc.expiresAt ? new Date(exc.expiresAt).toISOString() : null,
          expiration_type: exc.expirationType,
          status: exc.status,
          resolved_at: exc.resolvedAt ? new Date(exc.resolvedAt).toISOString() : null,
          resolution_type: exc.resolutionType || null,
          resolution_notes: exc.resolutionNotes || null,
          created_at: new Date(exc._creationTime).toISOString(),
          updated_at: exc.updatedAt ? new Date(exc.updatedAt).toISOString() : null,
          subcontractor_id: ps?.subcontractorId || null,
          project_id: ps?.projectId || null,
          subcontractor_name: subcontractor?.name || null,
          project_name: project?.name || null,
          created_by_name: createdBy?.name || null,
          approved_by_name: approvedBy?.name || null,
        }
      })
    )

    return {
      exceptions: results,
      total: results.length,
    }
  },
})

// Reject exception
export const reject = mutation({
  args: {
    id: v.id("exceptions"),
    rejectedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "closed",
      approvedByUserId: args.rejectedByUserId,
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// Create exception with auto-approval for admin/risk_manager
export const createWithAutoApproval = mutation({
  args: {
    projectSubcontractorId: v.id("projectSubcontractors"),
    verificationId: v.optional(v.id("verifications")),
    issueSummary: v.string(),
    reason: v.string(),
    riskLevel: riskLevel,
    createdByUserId: v.id("users"),
    expiresAt: v.optional(v.number()),
    expirationType: expirationType,
    autoApprove: v.boolean(),
    supportingDocumentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const status = args.autoApprove ? "active" : "pending_approval"

    const exceptionId = await ctx.db.insert("exceptions", {
      projectSubcontractorId: args.projectSubcontractorId,
      verificationId: args.verificationId,
      issueSummary: args.issueSummary,
      reason: args.reason,
      riskLevel: args.riskLevel,
      createdByUserId: args.createdByUserId,
      approvedByUserId: args.autoApprove ? args.createdByUserId : undefined,
      approvedAt: args.autoApprove ? Date.now() : undefined,
      expiresAt: args.expiresAt,
      expirationType: args.expirationType,
      status,
      resolvedAt: undefined,
      resolutionType: undefined,
      resolutionNotes: undefined,
      supportingDocumentUrl: args.supportingDocumentUrl,
      updatedAt: Date.now(),
    })

    // If auto-approved, update project_subcontractor status
    if (args.autoApprove) {
      await ctx.db.patch(args.projectSubcontractorId, {
        status: "exception",
        updatedAt: Date.now(),
      })
    }

    return { exceptionId, status }
  },
})

// Get exception by ID with full details
export const getByIdWithDetails = query({
  args: { id: v.id("exceptions") },
  handler: async (ctx, args) => {
    const exc = await ctx.db.get(args.id)
    if (!exc) return null

    const ps = await ctx.db.get(exc.projectSubcontractorId)
    const project = ps ? await ctx.db.get(ps.projectId) : null
    const subcontractor = ps ? await ctx.db.get(ps.subcontractorId) : null
    const createdBy = await ctx.db.get(exc.createdByUserId)
    const approvedBy = exc.approvedByUserId ? await ctx.db.get(exc.approvedByUserId) : null

    return {
      ...exc,
      id: exc._id,
      subcontractor_id: ps?.subcontractorId || null,
      project_id: ps?.projectId || null,
      subcontractor_name: subcontractor?.name || null,
      project_name: project?.name || null,
      project_company_id: project?.companyId || null,
      created_by_name: createdBy?.name || null,
      approved_by_name: approvedBy?.name || null,
    }
  },
})

// Get exception for audit trail PDF generation
export const getForAuditTrail = query({
  args: {
    id: v.id("exceptions"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const exc = await ctx.db.get(args.id)
    if (!exc) return null

    const ps = await ctx.db.get(exc.projectSubcontractorId)
    if (!ps) return null

    const project = await ctx.db.get(ps.projectId)
    if (!project || project.companyId !== args.companyId) return null

    const subcontractor = await ctx.db.get(ps.subcontractorId)
    const createdBy = await ctx.db.get(exc.createdByUserId)
    const approvedBy = exc.approvedByUserId ? await ctx.db.get(exc.approvedByUserId) : null
    const company = await ctx.db.get(args.companyId)

    return {
      id: exc._id,
      issue_summary: exc.issueSummary,
      reason: exc.reason,
      risk_level: exc.riskLevel,
      status: exc.status,
      expiration_type: exc.expirationType,
      expires_at: exc.expiresAt ? new Date(exc.expiresAt).toISOString() : null,
      created_at: new Date(exc._creationTime).toISOString(),
      subcontractor_name: subcontractor?.name || "Unknown",
      subcontractor_abn: subcontractor?.abn || "Unknown",
      project_name: project.name,
      created_by_name: createdBy?.name || "Unknown",
      created_by_email: createdBy?.email || "Unknown",
      approved_by_name: approvedBy?.name || null,
      approved_at: exc.approvedAt ? new Date(exc.approvedAt).toISOString() : null,
      company_name: company?.name || "Unknown",
    }
  },
})
