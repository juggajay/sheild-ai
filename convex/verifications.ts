import { v } from "convex/values"
import { mutation, query, internalQuery } from "./_generated/server"
import { Id } from "./_generated/dataModel"
import { api } from "./_generated/api"

// Internal query: Get verification by ID (for cron jobs)
export const getByIdInternal = internalQuery({
  args: { id: v.id("verifications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

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

// Get recent verifications for dashboard - OPTIMIZED
export const getRecent = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // BATCH QUERY 1: Get verifications
    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(args.limit || 10)

    if (verifications.length === 0) return []

    // BATCH QUERY 2: Get all documents in parallel
    const docIds = verifications.map((v) => v.cocDocumentId)
    const docPromises = docIds.map((id) => ctx.db.get(id))
    const docsArray = await Promise.all(docPromises)
    const docMap = new Map(
      docsArray
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => [d._id.toString(), d])
    )

    // BATCH QUERY 3: Get all subcontractors in parallel
    const subIds = Array.from(new Set(
      docsArray.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => d.subcontractorId)
    ))
    const subPromises = subIds.map((id) => ctx.db.get(id))
    const subsArray = await Promise.all(subPromises)
    const subMap = new Map(
      subsArray
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id.toString(), s])
    )

    // Process in memory
    return verifications.map((v) => {
      const doc = docMap.get(v.cocDocumentId.toString()) || null
      const subcontractor = doc ? subMap.get(doc.subcontractorId.toString()) || null : null
      return {
        ...v,
        document: doc,
        subcontractor,
      }
    })
  },
})

// Get document with verification and requirements for processing
export const getDocumentForProcessing = query({
  args: {
    documentId: v.id("cocDocuments"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId)
    if (!doc) return null

    // Verify project belongs to company
    const project = await ctx.db.get(doc.projectId)
    if (!project || project.companyId !== args.companyId) return null

    // Get subcontractor details
    const subcontractor = await ctx.db.get(doc.subcontractorId)

    // Get existing verification
    const verification = await ctx.db
      .query("verifications")
      .withIndex("by_document", (q) => q.eq("cocDocumentId", args.documentId))
      .first()

    // Get insurance requirements
    const requirements = await ctx.db
      .query("insuranceRequirements")
      .withIndex("by_project", (q) => q.eq("projectId", doc.projectId))
      .collect()

    return {
      document: doc,
      project: {
        id: project._id,
        name: project.name,
        endDate: project.endDate,
        state: project.state,
        companyId: project.companyId,
      },
      subcontractor: subcontractor
        ? {
            id: subcontractor._id,
            name: subcontractor.name,
            abn: subcontractor.abn,
            brokerName: subcontractor.brokerName,
            brokerEmail: subcontractor.brokerEmail,
            contactName: subcontractor.contactName,
            contactEmail: subcontractor.contactEmail,
          }
        : null,
      verification: verification
        ? {
            id: verification._id,
            status: verification.status,
            confidenceScore: verification.confidenceScore,
            extractedData: verification.extractedData,
            checks: verification.checks,
            deficiencies: verification.deficiencies,
            verifiedByUserId: verification.verifiedByUserId,
            verifiedAt: verification.verifiedAt,
          }
        : null,
      requirements: requirements.map((r) => ({
        coverageType: r.coverageType,
        minimumLimit: r.minimumLimit,
        limitType: r.limitType,
        maximumExcess: r.maximumExcess,
        principalIndemnityRequired: r.principalIndemnityRequired,
        crossLiabilityRequired: r.crossLiabilityRequired,
        waiverOfSubrogationRequired: r.waiverOfSubrogationRequired,
        principalNamingRequired: r.principalNamingRequired,
      })),
    }
  },
})

// Create or update verification with document processing
export const upsert = mutation({
  args: {
    cocDocumentId: v.id("cocDocuments"),
    projectId: v.id("projects"),
    status: verificationStatus,
    confidenceScore: v.optional(v.number()),
    extractedData: v.optional(v.any()),
    checks: v.optional(v.array(v.any())),
    deficiencies: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    // Check if verification already exists for this document
    const existing = await ctx.db
      .query("verifications")
      .withIndex("by_document", (q) => q.eq("cocDocumentId", args.cocDocumentId))
      .first()

    if (existing) {
      // Update existing verification
      await ctx.db.patch(existing._id, {
        status: args.status,
        confidenceScore: args.confidenceScore,
        extractedData: args.extractedData || {},
        checks: args.checks || [],
        deficiencies: args.deficiencies || [],
        updatedAt: Date.now(),
      })
      return existing._id
    }

    // Create new verification
    const verificationId = await ctx.db.insert("verifications", {
      cocDocumentId: args.cocDocumentId,
      projectId: args.projectId,
      status: args.status,
      confidenceScore: args.confidenceScore,
      extractedData: args.extractedData || {},
      checks: args.checks || [],
      deficiencies: args.deficiencies || [],
      updatedAt: Date.now(),
    })

    return verificationId
  },
})

// Get expirations for a date range - OPTIMIZED
export const getExpirations = query({
  args: {
    companyId: v.id("companies"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const defaultStart = now
    const defaultEnd = now + 90 * 24 * 60 * 60 * 1000 // 90 days

    const startDate = args.startDate || defaultStart
    const endDate = args.endDate || defaultEnd

    // BATCH QUERY 1: Get all projects for company (or specific project)
    let projects
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId)
      projects = project && project.companyId === args.companyId ? [project] : []
    } else {
      projects = await ctx.db
        .query("projects")
        .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
        .collect()
    }

    if (projects.length === 0) {
      return { expirations: [], byDate: {}, summary: { total: 0, expired: 0, expiringSoon: 0, valid: 0 } }
    }

    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]))

    // BATCH QUERY 2: Get all verifications for all projects in parallel
    const verPromises = projects.map((project) =>
      ctx.db
        .query("verifications")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()
    )
    const verArrays = await Promise.all(verPromises)
    const allVerifications = verArrays.flat()

    // Filter to pass/review status with expiry dates in range
    const relevantVerifications: Array<{
      verification: (typeof allVerifications)[number]
      expiryDateStr: string
      expiryDate: number
      daysUntilExpiry: number
      status: "expired" | "expiring_soon" | "valid"
    }> = []

    for (const v of allVerifications) {
      if (v.status !== "pass" && v.status !== "review") continue

      const extractedData = v.extractedData as Record<string, unknown> | null
      if (!extractedData) continue

      const expiryDateStr = extractedData.period_of_insurance_end as string
      if (!expiryDateStr) continue

      const expiryDate = new Date(expiryDateStr).getTime()
      if (expiryDate < startDate || expiryDate > endDate) continue

      const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
      let status: "expired" | "expiring_soon" | "valid" = "valid"
      if (daysUntilExpiry < 0) status = "expired"
      else if (daysUntilExpiry <= 30) status = "expiring_soon"

      relevantVerifications.push({ verification: v, expiryDateStr, expiryDate, daysUntilExpiry, status })
    }

    if (relevantVerifications.length === 0) {
      return { expirations: [], byDate: {}, summary: { total: 0, expired: 0, expiringSoon: 0, valid: 0 } }
    }

    // BATCH QUERY 3: Get all documents in parallel
    const docIds = Array.from(new Set(relevantVerifications.map((rv) => rv.verification.cocDocumentId)))
    const docPromises = docIds.map((id) => ctx.db.get(id))
    const docsArray = await Promise.all(docPromises)
    const docMap = new Map(
      docsArray
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => [d._id.toString(), d])
    )

    // BATCH QUERY 4: Get all subcontractors in parallel
    const subIds = Array.from(new Set(
      docsArray.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => d.subcontractorId)
    ))
    const subPromises = subIds.map((id) => ctx.db.get(id))
    const subsArray = await Promise.all(subPromises)
    const subMap = new Map(
      subsArray
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id.toString(), s])
    )

    // Process all in memory
    const expirations: Array<{
      id: string
      subcontractor_id: string
      subcontractor_name: string
      project_id: string
      project_name: string
      coc_document_id: string
      file_name: string | null
      policy_number: string
      insurer_name: string
      expiry_date: string
      days_until_expiry: number
      status: "expired" | "expiring_soon" | "valid"
    }> = []

    for (const { verification: v, expiryDateStr, daysUntilExpiry, status } of relevantVerifications) {
      const doc = docMap.get(v.cocDocumentId.toString())
      if (!doc) continue

      const subcontractor = subMap.get(doc.subcontractorId.toString())
      if (!subcontractor) continue

      const project = projectMap.get(v.projectId.toString())
      if (!project) continue

      const extractedData = v.extractedData as Record<string, unknown>

      expirations.push({
        id: v._id,
        subcontractor_id: subcontractor._id,
        subcontractor_name: subcontractor.name,
        project_id: project._id,
        project_name: project.name,
        coc_document_id: doc._id,
        file_name: doc.fileName || null,
        policy_number: (extractedData.policy_number as string) || "Unknown",
        insurer_name: (extractedData.insurer_name as string) || "Unknown",
        expiry_date: expiryDateStr,
        days_until_expiry: daysUntilExpiry,
        status,
      })
    }

    // Sort by expiry date
    expirations.sort(
      (a, b) =>
        new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
    )

    // Group by date
    const byDate: Record<string, typeof expirations> = {}
    for (const exp of expirations) {
      if (!byDate[exp.expiry_date]) {
        byDate[exp.expiry_date] = []
      }
      byDate[exp.expiry_date].push(exp)
    }

    // Calculate summary
    const summary = {
      total: expirations.length,
      expired: expirations.filter((e) => e.status === "expired").length,
      expiringSoon: expirations.filter((e) => e.status === "expiring_soon").length,
      valid: expirations.filter((e) => e.status === "valid").length,
    }

    return {
      expirations,
      byDate,
      summary,
    }
  },
})

// Get latest verification for a subcontractor (with details) - OPTIMIZED
export const getLatestBySubcontractor = query({
  args: { subcontractorId: v.id("subcontractors") },
  handler: async (ctx, args) => {
    // BATCH QUERY 1: Get all documents for this subcontractor
    const documents = await ctx.db
      .query("cocDocuments")
      .withIndex("by_subcontractor", (q) => q.eq("subcontractorId", args.subcontractorId))
      .collect()

    if (documents.length === 0) return null

    // BATCH QUERY 2: Get all verifications for these documents in parallel
    const verPromises = documents.map((doc) =>
      ctx.db
        .query("verifications")
        .withIndex("by_document", (q) => q.eq("cocDocumentId", doc._id))
        .first()
    )
    const verificationsArray = await Promise.all(verPromises)

    // Find latest verification in memory
    let latestVerification = null
    let latestTime = 0
    for (const verification of verificationsArray) {
      if (verification && verification._creationTime > latestTime) {
        latestVerification = verification
        latestTime = verification._creationTime
      }
    }

    if (!latestVerification) return null

    // Get subcontractor (we already have documents, no need to refetch document)
    const subcontractor = await ctx.db.get(args.subcontractorId)

    return {
      ...latestVerification,
      subcontractor_name: subcontractor?.name,
      subcontractor_abn: subcontractor?.abn,
    }
  },
})

// Get verification details for expiration reminder
export const getForExpirationReminder = query({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId)
    if (!verification) return null

    const doc = await ctx.db.get(verification.cocDocumentId)
    if (!doc) return null

    const project = await ctx.db.get(verification.projectId)
    const subcontractor = await ctx.db.get(doc.subcontractorId)

    return {
      id: verification._id,
      project_id: project?._id,
      project_name: project?.name,
      extracted_data: verification.extractedData,
      subcontractor_id: subcontractor?._id,
      subcontractor_name: subcontractor?.name,
      contact_email: subcontractor?.contactEmail,
      broker_email: subcontractor?.brokerEmail,
    }
  },
})

// ============================================
// PENDING REVIEWS QUERIES AND MUTATIONS
// ============================================

// Get count of verifications with status="review" for a company
export const getPendingReviewsCount = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    if (activeProjects.length === 0) return 0

    // Get all verifications for active projects in parallel
    const verPromises = activeProjects.map((project) =>
      ctx.db
        .query("verifications")
        .withIndex("by_status", (q) =>
          q.eq("projectId", project._id).eq("status", "review")
        )
        .collect()
    )
    const verArrays = await Promise.all(verPromises)

    // Count total
    return verArrays.reduce((sum, arr) => sum + arr.length, 0)
  },
})

// Get all pending reviews for a company (list page)
export const getPendingReviews = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    if (activeProjects.length === 0) return []

    const projectMap = new Map(activeProjects.map((p) => [p._id.toString(), p]))

    // Get all verifications with status="review" for active projects
    const verPromises = activeProjects.map((project) =>
      ctx.db
        .query("verifications")
        .withIndex("by_status", (q) =>
          q.eq("projectId", project._id).eq("status", "review")
        )
        .collect()
    )
    const verArrays = await Promise.all(verPromises)
    const allReviewVerifications = verArrays.flat()

    if (allReviewVerifications.length === 0) return []

    // Get all documents for these verifications
    const docIds = allReviewVerifications.map((v) => v.cocDocumentId)
    const docPromises = docIds.map((id) => ctx.db.get(id))
    const docsArray = await Promise.all(docPromises)
    const docMap = new Map(
      docsArray
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => [d._id.toString(), d])
    )

    // Get all subcontractors
    const subIds = Array.from(
      new Set(
        docsArray
          .filter((d): d is NonNullable<typeof d> => d !== null)
          .map((d) => d.subcontractorId)
      )
    )
    const subPromises = subIds.map((id) => ctx.db.get(id))
    const subsArray = await Promise.all(subPromises)
    const subMap = new Map(
      subsArray
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id.toString(), s])
    )

    // Build result list
    const results: Array<{
      id: string
      verificationId: string
      subcontractorId: string
      subcontractorName: string
      projectId: string
      projectName: string
      confidenceScore: number | null
      documentId: string
      fileName: string | null
      submittedAt: number
      daysWaiting: number
      lowConfidenceFields: string[]
    }> = []

    for (const verification of allReviewVerifications) {
      const doc = docMap.get(verification.cocDocumentId.toString())
      if (!doc) continue

      const subcontractor = subMap.get(doc.subcontractorId.toString())
      if (!subcontractor) continue

      const project = projectMap.get(verification.projectId.toString())
      if (!project) continue

      // Calculate days waiting
      const submittedAt = doc.receivedAt || verification._creationTime
      const daysWaiting = Math.floor(
        (Date.now() - submittedAt) / (1000 * 60 * 60 * 24)
      )

      // Find low confidence fields
      const lowConfidenceFields: string[] = []
      const extractedData = verification.extractedData as Record<string, unknown> | null
      if (extractedData?.field_confidences) {
        const fieldConfidences = extractedData.field_confidences as Record<string, number>
        for (const [field, confidence] of Object.entries(fieldConfidences)) {
          if (confidence < 80) {
            lowConfidenceFields.push(field)
          }
        }
      }

      results.push({
        id: verification._id,
        verificationId: verification._id,
        subcontractorId: subcontractor._id,
        subcontractorName: subcontractor.name,
        projectId: project._id,
        projectName: project.name,
        confidenceScore: verification.confidenceScore || null,
        documentId: doc._id,
        fileName: doc.fileName || null,
        submittedAt,
        daysWaiting,
        lowConfidenceFields,
      })
    }

    // Sort by oldest first (FIFO queue)
    results.sort((a, b) => a.submittedAt - b.submittedAt)

    return results
  },
})

// Get full verification details for review (detail page)
export const getVerificationForReview = query({
  args: { id: v.id("verifications") },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.id)
    if (!verification) return null

    const document = await ctx.db.get(verification.cocDocumentId)
    if (!document) return null

    const [project, subcontractor] = await Promise.all([
      ctx.db.get(verification.projectId),
      ctx.db.get(document.subcontractorId),
    ])

    if (!project || !subcontractor) return null

    // Get insurance requirements for this project
    const requirements = await ctx.db
      .query("insuranceRequirements")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect()

    // Get project subcontractor link for status
    const projectSubcontractor = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project_subcontractor", (q) =>
        q.eq("projectId", project._id).eq("subcontractorId", subcontractor._id)
      )
      .first()

    // Get verified by user if exists
    let verifiedByUser = null
    if (verification.verifiedByUserId) {
      const user = await ctx.db.get(verification.verifiedByUserId)
      if (user) {
        verifiedByUser = {
          id: user._id,
          name: user.name,
          email: user.email,
        }
      }
    }

    return {
      verification: {
        id: verification._id,
        status: verification.status,
        confidenceScore: verification.confidenceScore,
        extractedData: verification.extractedData,
        checks: verification.checks,
        deficiencies: verification.deficiencies,
        verifiedAt: verification.verifiedAt,
        createdAt: verification._creationTime,
      },
      document: {
        id: document._id,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        fileSize: document.fileSize,
        receivedAt: document.receivedAt,
        source: document.source,
      },
      project: {
        id: project._id,
        name: project.name,
        state: project.state,
      },
      subcontractor: {
        id: subcontractor._id,
        name: subcontractor.name,
        abn: subcontractor.abn,
        contactName: subcontractor.contactName,
        contactEmail: subcontractor.contactEmail,
        brokerName: subcontractor.brokerName,
        brokerEmail: subcontractor.brokerEmail,
      },
      requirements: requirements.map((r) => ({
        coverageType: r.coverageType,
        minimumLimit: r.minimumLimit,
        limitType: r.limitType,
        maximumExcess: r.maximumExcess,
        principalIndemnityRequired: r.principalIndemnityRequired,
        crossLiabilityRequired: r.crossLiabilityRequired,
        waiverOfSubrogationRequired: r.waiverOfSubrogationRequired,
        principalNamingRequired: r.principalNamingRequired,
      })),
      projectSubcontractorId: projectSubcontractor?._id || null,
      verifiedByUser,
    }
  },
})

// Approve verification (manual review action)
export const approveVerification = mutation({
  args: {
    id: v.id("verifications"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.id)
    if (!verification) throw new Error("Verification not found")

    const previousStatus = verification.status

    // Update verification status
    await ctx.db.patch(args.id, {
      status: "pass",
      verifiedByUserId: args.userId,
      verifiedAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Get document to find project subcontractor
    const document = await ctx.db.get(verification.cocDocumentId)
    if (document) {
      // Update project subcontractor status to compliant
      const projectSubcontractor = await ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project_subcontractor", (q) =>
          q
            .eq("projectId", verification.projectId)
            .eq("subcontractorId", document.subcontractorId)
        )
        .first()

      if (projectSubcontractor) {
        await ctx.db.patch(projectSubcontractor._id, {
          status: "compliant",
          updatedAt: Date.now(),
        })
      }
    }

    // Get details for audit log
    const project = await ctx.db.get(verification.projectId)
    const subcontractor = document
      ? await ctx.db.get(document.subcontractorId)
      : null

    // Create audit log
    await ctx.db.insert("auditLogs", {
      companyId: project?.companyId,
      userId: args.userId,
      entityType: "verification",
      entityId: args.id,
      action: "verification_manually_approved",
      details: {
        previousStatus,
        newStatus: "pass",
        subcontractorName: subcontractor?.name,
        projectName: project?.name,
      },
    })

    return { success: true }
  },
})

// Reject verification (manual review action)
export const rejectVerification = mutation({
  args: {
    id: v.id("verifications"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
    deficiencies: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.id)
    if (!verification) throw new Error("Verification not found")

    const previousStatus = verification.status

    // Merge existing deficiencies with new ones
    const existingDeficiencies = (verification.deficiencies || []) as Array<unknown>
    const newDeficiencies = args.deficiencies || []
    const allDeficiencies = [...existingDeficiencies, ...newDeficiencies]

    // Update verification status
    await ctx.db.patch(args.id, {
      status: "fail",
      deficiencies: allDeficiencies,
      verifiedByUserId: args.userId,
      verifiedAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Get document to find project subcontractor
    const document = await ctx.db.get(verification.cocDocumentId)
    if (document) {
      // Update project subcontractor status to non_compliant
      const projectSubcontractor = await ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project_subcontractor", (q) =>
          q
            .eq("projectId", verification.projectId)
            .eq("subcontractorId", document.subcontractorId)
        )
        .first()

      if (projectSubcontractor) {
        await ctx.db.patch(projectSubcontractor._id, {
          status: "non_compliant",
          updatedAt: Date.now(),
        })
      }
    }

    // Get details for audit log
    const project = await ctx.db.get(verification.projectId)
    const subcontractor = document
      ? await ctx.db.get(document.subcontractorId)
      : null

    // Create audit log
    await ctx.db.insert("auditLogs", {
      companyId: project?.companyId,
      userId: args.userId,
      entityType: "verification",
      entityId: args.id,
      action: "verification_manually_rejected",
      details: {
        previousStatus,
        newStatus: "fail",
        reason: args.reason,
        subcontractorName: subcontractor?.name,
        projectName: project?.name,
        deficienciesAdded: newDeficiencies.length,
      },
    })

    // Create communication record for deficiency email
    // Send to subcontractor contact first (they contact their own broker)
    if (subcontractor && project) {
      await ctx.db.insert("communications", {
        subcontractorId: subcontractor._id,
        projectId: project._id,
        verificationId: args.id,
        type: "deficiency",
        channel: "email",
        recipientEmail: subcontractor.contactEmail || subcontractor.brokerEmail,
        status: "pending",
        updatedAt: Date.now(),
      })
    }

    return {
      success: true,
      shouldSendEmail: true,
      subcontractorEmail: subcontractor?.contactEmail || subcontractor?.brokerEmail,
      subcontractorName: subcontractor?.name,
      projectName: project?.name,
    }
  },
})

// Request clearer copy (manual review action)
export const requestClearerCopy = mutation({
  args: {
    id: v.id("verifications"),
    userId: v.id("users"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.id)
    if (!verification) throw new Error("Verification not found")

    // Keep status as review but log the request
    await ctx.db.patch(args.id, {
      updatedAt: Date.now(),
    })

    // Get document to find subcontractor
    const document = await ctx.db.get(verification.cocDocumentId)
    if (!document) throw new Error("Document not found")

    // Get details
    const project = await ctx.db.get(verification.projectId)
    const subcontractor = await ctx.db.get(document.subcontractorId)

    if (!project || !subcontractor) {
      throw new Error("Project or subcontractor not found")
    }

    // Create communication record for clearer copy request
    // Send to subcontractor contact first (they contact their own broker)
    await ctx.db.insert("communications", {
      subcontractorId: subcontractor._id,
      projectId: project._id,
      verificationId: args.id,
      type: "follow_up",
      channel: "email",
      recipientEmail: subcontractor.contactEmail || subcontractor.brokerEmail,
      subject: `We need a clearer copy of your insurance certificate - ${project.name}`,
      body: args.message || "The document you sent us is hard to read. Please upload a clearer copy.",
      status: "pending",
      updatedAt: Date.now(),
    })

    // Create audit log
    await ctx.db.insert("auditLogs", {
      companyId: project.companyId,
      userId: args.userId,
      entityType: "verification",
      entityId: args.id,
      action: "clearer_copy_requested",
      details: {
        subcontractorName: subcontractor.name,
        projectName: project.name,
        message: args.message,
      },
    })

    return {
      success: true,
      subcontractorEmail: subcontractor.contactEmail || subcontractor.brokerEmail,
      subcontractorName: subcontractor.name,
      projectName: project.name,
    }
  },
})
