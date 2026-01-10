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

// Get subcontractors by multiple ABNs within company (for conflict detection)
export const getByAbns = query({
  args: {
    companyId: v.id("companies"),
    abns: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.abns.length === 0) return []

    // Get all subcontractors for the company and filter by ABN
    const allSubcontractors = await ctx.db
      .query("subcontractors")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    // Filter to those with matching ABNs
    const abnSet = new Set(args.abns)
    return allSubcontractors.filter((sub) => sub.abn && abnSet.has(sub.abn))
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

// Get paginated subcontractors with project counts
export const listPaginated = query({
  args: {
    companyId: v.id("companies"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20

    // Get all subcontractors for the company (for total count)
    const allSubcontractors = await ctx.db
      .query("subcontractors")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const total = allSubcontractors.length

    // Sort by name and paginate
    allSubcontractors.sort((a, b) => a.name.localeCompare(b.name))

    // Simple offset-based pagination using cursor as offset
    const offset = args.cursor ? parseInt(args.cursor) : 0
    const paginatedSubs = allSubcontractors.slice(offset, offset + limit)

    // Get project counts for each subcontractor
    const results = await Promise.all(
      paginatedSubs.map(async (sub) => {
        // Get active project assignments
        const projectAssignments = await ctx.db
          .query("projectSubcontractors")
          .withIndex("by_subcontractor", (q) => q.eq("subcontractorId", sub._id))
          .collect()

        // Count active projects (not completed)
        let projectCount = 0
        for (const pa of projectAssignments) {
          const project = await ctx.db.get(pa.projectId)
          if (project && project.status !== "completed") {
            projectCount++
          }
        }

        return {
          ...sub,
          projectCount,
        }
      })
    )

    // Next cursor
    const hasMore = offset + limit < total
    const nextCursor = hasMore ? String(offset + limit) : null

    return {
      subcontractors: results,
      total,
      nextCursor,
      hasMore,
    }
  },
})

// Get subcontractor with full details
export const getByIdWithDetails = query({
  args: { id: v.id("subcontractors") },
  handler: async (ctx, args) => {
    const subcontractor = await ctx.db.get(args.id)
    if (!subcontractor) return null

    // Get project assignments
    const projectAssignments = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_subcontractor", (q) => q.eq("subcontractorId", args.id))
      .collect()

    // Get project details for active projects
    const projects = []
    let projectCount = 0
    for (const pa of projectAssignments) {
      const project = await ctx.db.get(pa.projectId)
      if (project && project.status !== "completed") {
        projectCount++
        projects.push({
          id: project._id,
          name: project.name,
          projectStatus: project.status,
          complianceStatus: pa.status,
          onSiteDate: pa.onSiteDate,
        })
      }
    }

    // Get COC documents
    const cocDocuments = await ctx.db
      .query("cocDocuments")
      .withIndex("by_subcontractor", (q) => q.eq("subcontractorId", args.id))
      .order("desc")
      .collect()

    // Get verifications for each document
    const docsWithVerifications = await Promise.all(
      cocDocuments.map(async (doc) => {
        const verification = await ctx.db
          .query("verifications")
          .withIndex("by_document", (q) => q.eq("cocDocumentId", doc._id))
          .first()

        const project = await ctx.db.get(doc.projectId)

        return {
          id: doc._id,
          projectId: doc.projectId,
          projectName: project?.name || null,
          fileUrl: doc.fileUrl,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          source: doc.source,
          sourceEmail: doc.sourceEmail,
          receivedAt: doc.receivedAt,
          processedAt: doc.processedAt,
          processingStatus: doc.processingStatus,
          createdAt: doc._creationTime,
          verification: verification
            ? {
                id: verification._id,
                status: verification.status,
                confidenceScore: verification.confidenceScore,
                extractedData: verification.extractedData,
                checks: verification.checks,
                deficiencies: verification.deficiencies,
                verifiedAt: verification.verifiedAt,
              }
            : null,
        }
      })
    )

    // Get current COC (most recent with verification)
    const currentCoc = docsWithVerifications.find((doc) => doc.verification)

    // Get communications
    const communications = await ctx.db
      .query("communications")
      .withIndex("by_subcontractor", (q) => q.eq("subcontractorId", args.id))
      .order("desc")
      .collect()

    const communicationsWithDetails = await Promise.all(
      communications.map(async (comm) => {
        const project = await ctx.db.get(comm.projectId)
        return {
          ...comm,
          projectName: project?.name || null,
          ccEmails: comm.ccEmails ? comm.ccEmails.split(",") : [],
        }
      })
    )

    return {
      subcontractor: {
        ...subcontractor,
        portalAccess: Boolean(subcontractor.portalAccess),
        projectCount,
      },
      projects,
      cocDocuments: docsWithVerifications,
      currentCoc,
      communications: communicationsWithDetails,
    }
  },
})
