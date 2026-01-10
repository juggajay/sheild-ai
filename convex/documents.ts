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
