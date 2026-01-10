import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Document source type validator
const documentSource = v.union(
  v.literal("email"),
  v.literal("upload"),
  v.literal("portal"),
  v.literal("api")
)

// Processing status type validator
const processingStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed")
)

// Get document by ID
export const getById = query({
  args: { id: v.id("cocDocuments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get document by ID with related data
export const getByIdWithDetails = query({
  args: { id: v.id("cocDocuments") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id)
    if (!doc) return null

    const [subcontractor, project, verification] = await Promise.all([
      ctx.db.get(doc.subcontractorId),
      ctx.db.get(doc.projectId),
      ctx.db
        .query("verifications")
        .withIndex("by_document", (q) => q.eq("cocDocumentId", args.id))
        .first(),
    ])

    return {
      ...doc,
      subcontractor,
      project,
      verification,
    }
  },
})

// Get documents by subcontractor
export const getBySubcontractor = query({
  args: { subcontractorId: v.id("subcontractors") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cocDocuments")
      .withIndex("by_subcontractor", (q) => q.eq("subcontractorId", args.subcontractorId))
      .order("desc")
      .collect()
  },
})

// Get documents by project
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cocDocuments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect()
  },
})

// Get documents by subcontractor and project
export const getBySubcontractorAndProject = query({
  args: {
    subcontractorId: v.id("subcontractors"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cocDocuments")
      .withIndex("by_subcontractor_project", (q) =>
        q.eq("subcontractorId", args.subcontractorId).eq("projectId", args.projectId)
      )
      .order("desc")
      .collect()
  },
})

// Get documents by processing status
export const getByProcessingStatus = query({
  args: { status: processingStatus },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cocDocuments")
      .withIndex("by_processing_status", (q) => q.eq("processingStatus", args.status))
      .collect()
  },
})

// Get pending documents (for processing queue)
export const getPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("cocDocuments")
      .withIndex("by_processing_status", (q) => q.eq("processingStatus", "pending"))
      .take(100)
  },
})

// Create document
export const create = mutation({
  args: {
    subcontractorId: v.id("subcontractors"),
    projectId: v.id("projects"),
    fileUrl: v.string(),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
    source: documentSource,
    sourceEmail: v.optional(v.string()),
    receivedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const docId = await ctx.db.insert("cocDocuments", {
      subcontractorId: args.subcontractorId,
      projectId: args.projectId,
      fileUrl: args.fileUrl,
      fileName: args.fileName,
      fileSize: args.fileSize,
      storageId: args.storageId,
      source: args.source,
      sourceEmail: args.sourceEmail?.toLowerCase(),
      receivedAt: args.receivedAt || Date.now(),
      processedAt: undefined,
      processingStatus: "pending",
      updatedAt: Date.now(),
    })

    return docId
  },
})

// Update document processing status
export const updateProcessingStatus = mutation({
  args: {
    id: v.id("cocDocuments"),
    processingStatus: processingStatus,
    processedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      processingStatus: args.processingStatus,
      processedAt: args.processedAt || (args.processingStatus === "completed" ? Date.now() : undefined),
      updatedAt: Date.now(),
    })
  },
})

// Update document
export const update = mutation({
  args: {
    id: v.id("cocDocuments"),
    fileUrl: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
    source: v.optional(documentSource),
    sourceEmail: v.optional(v.string()),
    receivedAt: v.optional(v.number()),
    processedAt: v.optional(v.number()),
    processingStatus: v.optional(processingStatus),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args

    // Normalize email
    if (updates.sourceEmail) {
      updates.sourceEmail = updates.sourceEmail.toLowerCase()
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

// Delete document
export const remove = mutation({
  args: { id: v.id("cocDocuments") },
  handler: async (ctx, args) => {
    // Also delete related verifications
    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_document", (q) => q.eq("cocDocumentId", args.id))
      .collect()

    for (const verification of verifications) {
      await ctx.db.delete(verification._id)
    }

    // Delete the document
    await ctx.db.delete(args.id)
  },
})

// Get latest document for subcontractor-project pair
export const getLatest = query({
  args: {
    subcontractorId: v.id("subcontractors"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cocDocuments")
      .withIndex("by_subcontractor_project", (q) =>
        q.eq("subcontractorId", args.subcontractorId).eq("projectId", args.projectId)
      )
      .order("desc")
      .first()
  },
})

// Generate upload URL for file storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

// Get file URL from storage ID
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

// List documents by company with filtering and details
export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    projectId: v.optional(v.id("projects")),
    subcontractorId: v.optional(v.id("subcontractors")),
  },
  handler: async (ctx, args) => {
    // Get all projects for this company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const projectIds = new Set(projects.map((p) => p._id))

    // Get documents filtered appropriately
    let documents

    if (args.projectId) {
      // Filter by specific project
      if (!projectIds.has(args.projectId)) {
        return { documents: [], total: 0 }
      }

      if (args.subcontractorId) {
        documents = await ctx.db
          .query("cocDocuments")
          .withIndex("by_subcontractor_project", (q) =>
            q.eq("subcontractorId", args.subcontractorId!).eq("projectId", args.projectId!)
          )
          .order("desc")
          .collect()
      } else {
        documents = await ctx.db
          .query("cocDocuments")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
          .order("desc")
          .collect()
      }
    } else if (args.subcontractorId) {
      // Filter by subcontractor across all company projects
      const allSubDocs = await ctx.db
        .query("cocDocuments")
        .withIndex("by_subcontractor", (q) => q.eq("subcontractorId", args.subcontractorId!))
        .order("desc")
        .collect()

      documents = allSubDocs.filter((d) => projectIds.has(d.projectId))
    } else {
      // Get all documents for company's projects
      const allDocs = []
      for (const projectId of Array.from(projectIds)) {
        const projectDocs = await ctx.db
          .query("cocDocuments")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect()
        allDocs.push(...projectDocs)
      }
      // Sort by creation time descending
      allDocs.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0))
      documents = allDocs
    }

    // Enrich with subcontractor, project, and verification data
    const results = await Promise.all(
      (documents || []).map(async (doc) => {
        const [subcontractor, project, verification] = await Promise.all([
          ctx.db.get(doc.subcontractorId),
          ctx.db.get(doc.projectId),
          ctx.db
            .query("verifications")
            .withIndex("by_document", (q) => q.eq("cocDocumentId", doc._id))
            .first(),
        ])

        return {
          ...doc,
          subcontractor_name: subcontractor?.name,
          subcontractor_abn: subcontractor?.abn,
          project_name: project?.name,
          verification_status: verification?.status,
          confidence_score: verification?.confidenceScore,
        }
      })
    )

    return {
      documents: results,
      total: results.length,
    }
  },
})

// Get document by ID with full details for company validation
export const getByIdForCompany = query({
  args: {
    id: v.id("cocDocuments"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id)
    if (!doc) return null

    // Verify project belongs to company
    const project = await ctx.db.get(doc.projectId)
    if (!project || project.companyId !== args.companyId) return null

    const [subcontractor, verification] = await Promise.all([
      ctx.db.get(doc.subcontractorId),
      ctx.db
        .query("verifications")
        .withIndex("by_document", (q) => q.eq("cocDocumentId", args.id))
        .first(),
    ])

    return {
      ...doc,
      company_id: project.companyId,
      subcontractor_name: subcontractor?.name,
      subcontractor_abn: subcontractor?.abn,
      project_name: project?.name,
      project_manager_id: project?.projectManagerId,
      verification_id: verification?._id,
      verification_status: verification?.status,
      confidence_score: verification?.confidenceScore,
      extracted_data: verification?.extractedData,
      checks: verification?.checks,
      deficiencies: verification?.deficiencies,
      verified_by_user_id: verification?.verifiedByUserId,
      verified_at: verification?.verifiedAt,
    }
  },
})

// Validate document access for download
export const validateDocumentAccess = query({
  args: {
    documentId: v.id("cocDocuments"),
    userId: v.id("users"),
    userRole: v.string(),
    userCompanyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId)
    if (!doc) return { canAccess: false, document: null }

    // Get project to verify company
    const project = await ctx.db.get(doc.projectId)
    if (!project || project.companyId !== args.userCompanyId) {
      return { canAccess: false, document: null }
    }

    // For project_manager role, check if they manage this project
    if (args.userRole === "project_manager" && project.projectManagerId !== args.userId) {
      return { canAccess: false, document: null }
    }

    return {
      canAccess: true,
      document: {
        ...doc,
        project_manager_id: project.projectManagerId,
      },
    }
  },
})
