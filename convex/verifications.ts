import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Verification status type validator
const verificationStatus = v.union(
  v.literal("pass"),
  v.literal("fail"),
  v.literal("review")
)

// Get verification by ID
export const getById = query({
  args: { id: v.id("verifications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get verification by ID with related data
export const getByIdWithDetails = query({
  args: { id: v.id("verifications") },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.id)
    if (!verification) return null

    const [document, project, verifiedByUser] = await Promise.all([
      ctx.db.get(verification.cocDocumentId),
      ctx.db.get(verification.projectId),
      verification.verifiedByUserId
        ? ctx.db.get(verification.verifiedByUserId)
        : null,
    ])

    // Get subcontractor from document
    let subcontractor = null
    if (document) {
      subcontractor = await ctx.db.get(document.subcontractorId)
    }

    return {
      ...verification,
      document,
      project,
      subcontractor,
      verifiedByUser: verifiedByUser
        ? { ...verifiedByUser, passwordHash: undefined }
        : null,
    }
  },
})

// Get verification by document
export const getByDocument = query({
  args: { cocDocumentId: v.id("cocDocuments") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("verifications")
      .withIndex("by_document", (q) => q.eq("cocDocumentId", args.cocDocumentId))
      .first()
  },
})

// Get verifications by project
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("verifications")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect()
  },
})

// Get verifications by project and status
export const getByProjectAndStatus = query({
  args: {
    projectId: v.id("projects"),
    status: verificationStatus,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("verifications")
      .withIndex("by_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", args.status)
      )
      .collect()
  },
})

// Create verification
export const create = mutation({
  args: {
    cocDocumentId: v.id("cocDocuments"),
    projectId: v.id("projects"),
    status: verificationStatus,
    confidenceScore: v.optional(v.number()),
    extractedData: v.optional(v.any()),
    checks: v.optional(v.array(v.any())),
    deficiencies: v.optional(v.array(v.any())),
    verifiedByUserId: v.optional(v.id("users")),
    verifiedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if verification already exists for this document
    const existing = await ctx.db
      .query("verifications")
      .withIndex("by_document", (q) => q.eq("cocDocumentId", args.cocDocumentId))
      .first()

    if (existing) {
      throw new Error("Verification already exists for this document")
    }

    const verificationId = await ctx.db.insert("verifications", {
      cocDocumentId: args.cocDocumentId,
      projectId: args.projectId,
      status: args.status,
      confidenceScore: args.confidenceScore,
      extractedData: args.extractedData || {},
      checks: args.checks || [],
      deficiencies: args.deficiencies || [],
      verifiedByUserId: args.verifiedByUserId,
      verifiedAt: args.verifiedAt,
      updatedAt: Date.now(),
    })

    // Update document processing status
    await ctx.db.patch(args.cocDocumentId, {
      processingStatus: "completed",
      processedAt: Date.now(),
      updatedAt: Date.now(),
    })

    return verificationId
  },
})

// Update verification
export const update = mutation({
  args: {
    id: v.id("verifications"),
    status: v.optional(verificationStatus),
    confidenceScore: v.optional(v.number()),
    extractedData: v.optional(v.any()),
    checks: v.optional(v.array(v.any())),
    deficiencies: v.optional(v.array(v.any())),
    verifiedByUserId: v.optional(v.id("users")),
    verifiedAt: v.optional(v.number()),
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

// Manual verification by user
export const manualVerify = mutation({
  args: {
    id: v.id("verifications"),
    status: verificationStatus,
    verifiedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      verifiedByUserId: args.verifiedByUserId,
      verifiedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// Delete verification
export const remove = mutation({
  args: { id: v.id("verifications") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

// Get verification stats for a project
export const getProjectStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    return {
      total: verifications.length,
      pass: verifications.filter((v) => v.status === "pass").length,
      fail: verifications.filter((v) => v.status === "fail").length,
      review: verifications.filter((v) => v.status === "review").length,
      averageConfidence:
        verifications.length > 0
          ? Math.round(
              verifications.reduce((acc, v) => acc + (v.confidenceScore || 0), 0) /
                verifications.length
            )
          : 0,
    }
  },
})

// Get recent verifications for dashboard
export const getRecent = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(args.limit || 10)

    // Get document and subcontractor details
    const results = await Promise.all(
      verifications.map(async (v) => {
        const doc = await ctx.db.get(v.cocDocumentId)
        const subcontractor = doc ? await ctx.db.get(doc.subcontractorId) : null
        return {
          ...v,
          document: doc,
          subcontractor,
        }
      })
    )

    return results
  },
})
