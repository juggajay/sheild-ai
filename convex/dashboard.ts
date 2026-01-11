import { v } from "convex/values"
import { query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Get stop work risks - subcontractors on-site today/past with non-compliant status (OPTIMIZED)
export const getStopWorkRisks = query({
  args: {
    companyId: v.id("companies"),
    includeExceptionCount: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()

    // BATCH QUERY 1: Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    if (activeProjects.length === 0) return []

    const projectMap = new Map(activeProjects.map((p) => [p._id, p]))
    const activeProjectIds = activeProjects.map((p) => p._id)

    // BATCH QUERY 2: Get all projectSubcontractors for active projects in parallel
    const projectSubsPromises = activeProjectIds.map((projectId) =>
      ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect()
    )
    const projectSubsArrays = await Promise.all(projectSubsPromises)
    const allProjectSubs = projectSubsArrays.flat()

    // Filter to only at-risk subcontractors (on-site today/past + non-compliant/pending)
    const atRiskSubs = allProjectSubs.filter((ps) => {
      if (!ps.onSiteDate) return false
      const onSiteTimestamp = new Date(ps.onSiteDate).getTime()
      if (onSiteTimestamp > todayTimestamp) return false
      return ["non_compliant", "pending"].includes(ps.status)
    })

    if (atRiskSubs.length === 0) return []

    // BATCH QUERY 3: Get all subcontractors we need in parallel
    const subcontractorIds = Array.from(new Set(atRiskSubs.map((ps) => ps.subcontractorId)))
    const subcontractorPromises = subcontractorIds.map((id) => ctx.db.get(id))
    const subcontractorsArray = await Promise.all(subcontractorPromises)
    const subcontractorMap = new Map(
      subcontractorsArray
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s])
    )

    // BATCH QUERY 4: Get exceptions if needed in parallel
    let exceptionCountMap = new Map<string, number>()
    if (args.includeExceptionCount) {
      const exceptionPromises = atRiskSubs.map((ps) =>
        ctx.db
          .query("exceptions")
          .withIndex("by_project_subcontractor", (q) =>
            q.eq("projectSubcontractorId", ps._id)
          )
          .collect()
      )
      const exceptionsArrays = await Promise.all(exceptionPromises)
      for (let i = 0; i < atRiskSubs.length; i++) {
        const activeCount = exceptionsArrays[i].filter((e) => e.status === "active").length
        exceptionCountMap.set(atRiskSubs[i]._id, activeCount)
      }
    }

    // Process in memory
    const stopWorkRisks: Array<{
      id: string
      status: string
      on_site_date: string | null
      project_id: string
      project_name: string
      subcontractor_id: string
      subcontractor_name: string
      subcontractor_abn: string
      contact_phone: string | null
      broker_phone: string | null
      active_exceptions?: number
    }> = []

    for (const ps of atRiskSubs) {
      const subcontractor = subcontractorMap.get(ps.subcontractorId)
      if (!subcontractor) continue

      const project = projectMap.get(ps.projectId)
      if (!project) continue

      stopWorkRisks.push({
        id: ps._id,
        status: ps.status,
        on_site_date: ps.onSiteDate
          ? new Date(ps.onSiteDate).toISOString().split("T")[0]
          : null,
        project_id: project._id,
        project_name: project.name,
        subcontractor_id: subcontractor._id,
        subcontractor_name: subcontractor.name,
        subcontractor_abn: subcontractor.abn,
        contact_phone: subcontractor.contactPhone || null,
        broker_phone: subcontractor.brokerPhone || null,
        ...(args.includeExceptionCount && {
          active_exceptions: exceptionCountMap.get(ps._id) || 0,
        }),
      })
    }

    // Sort by on-site date ascending
    stopWorkRisks.sort((a, b) => {
      if (!a.on_site_date && !b.on_site_date) return 0
      if (!a.on_site_date) return 1
      if (!b.on_site_date) return -1
      return (
        new Date(a.on_site_date).getTime() - new Date(b.on_site_date).getTime()
      )
    })

    return stopWorkRisks
  },
})

// Get compliance statistics for active projects (OPTIMIZED)
export const getComplianceStats = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // BATCH QUERY 1: Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    if (activeProjects.length === 0) {
      return {
        total: 0,
        compliant: 0,
        non_compliant: 0,
        pending: 0,
        exception: 0,
        complianceRate: null,
        activeProjects: 0,
      }
    }

    // BATCH QUERY 2: Get all projectSubcontractors for active projects in parallel
    const projectSubsPromises = activeProjects.map((project) =>
      ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()
    )
    const projectSubsArrays = await Promise.all(projectSubsPromises)
    const allProjectSubs = projectSubsArrays.flat()

    // Count statuses in memory
    let total = 0
    let compliant = 0
    let nonCompliant = 0
    let pending = 0
    let exception = 0

    for (const ps of allProjectSubs) {
      total++
      if (ps.status === "compliant") compliant++
      else if (ps.status === "non_compliant") nonCompliant++
      else if (ps.status === "pending") pending++
      else if (ps.status === "exception") exception++
    }

    const complianceRate =
      total > 0 ? Math.round(((compliant + exception) / total) * 100) : null

    return {
      total,
      compliant,
      non_compliant: nonCompliant,
      pending,
      exception,
      complianceRate,
      activeProjects: activeProjects.length,
    }
  },
})

// Get pending document reviews count (OPTIMIZED)
export const getPendingReviewsCount = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // BATCH QUERY 1: Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    if (activeProjects.length === 0) return 0

    // BATCH QUERY 2: Get all documents for active projects in parallel
    const docsPromises = activeProjects.map((project) =>
      ctx.db
        .query("cocDocuments")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()
    )
    const docsArrays = await Promise.all(docsPromises)
    const allDocs = docsArrays.flat()

    // Count pending in memory
    return allDocs.filter((d) => d.processingStatus === "pending").length
  },
})

// Get new COCs received in last 24 hours (OPTIMIZED)
export const getNewCocs = query({
  args: {
    companyId: v.id("companies"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000

    // BATCH QUERY 1: Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    if (activeProjects.length === 0) return []

    const projectMap = new Map(activeProjects.map((p) => [p._id, p]))

    // BATCH QUERY 2: Get all documents for active projects in parallel
    const docsPromises = activeProjects.map((project) =>
      ctx.db
        .query("cocDocuments")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()
    )
    const docsArrays = await Promise.all(docsPromises)
    const allDocs = docsArrays.flat()

    // Filter to recent docs only
    const recentDocs = allDocs.filter((doc) => doc.receivedAt && doc.receivedAt >= yesterday)
    if (recentDocs.length === 0) return []

    // BATCH QUERY 3: Get all subcontractors we need in parallel
    const subcontractorIds = Array.from(new Set(recentDocs.map((d) => d.subcontractorId)))
    const subcontractorPromises = subcontractorIds.map((id) => ctx.db.get(id))
    const subcontractorsArray = await Promise.all(subcontractorPromises)
    const subcontractorMap = new Map(
      subcontractorsArray
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s])
    )

    // BATCH QUERY 4: Get verifications for recent docs in parallel
    const verificationPromises = recentDocs.map((doc) =>
      ctx.db
        .query("verifications")
        .withIndex("by_document", (q) => q.eq("cocDocumentId", doc._id))
        .first()
    )
    const verificationsArray = await Promise.all(verificationPromises)
    const verificationMap = new Map<string, (typeof verificationsArray)[number]>()
    for (let i = 0; i < recentDocs.length; i++) {
      verificationMap.set(recentDocs[i]._id, verificationsArray[i])
    }

    // Process in memory
    const newCocs: Array<{
      id: string
      file_name: string | null
      received_at: string
      processing_status: string
      subcontractor_name: string
      project_name: string
      verification_status: string | null
    }> = []

    for (const doc of recentDocs) {
      const project = doc.projectId ? projectMap.get(doc.projectId) : null
      if (!project) continue

      const subcontractor = subcontractorMap.get(doc.subcontractorId)
      const verification = verificationMap.get(doc._id)

      newCocs.push({
        id: doc._id,
        file_name: doc.fileName || null,
        received_at: new Date(doc.receivedAt!).toISOString(),
        processing_status: doc.processingStatus,
        subcontractor_name: subcontractor?.name || "Unknown",
        project_name: project.name,
        verification_status: verification?.status || null,
      })
    }

    // Sort by received_at descending
    newCocs.sort(
      (a, b) =>
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    )

    return newCocs.slice(0, args.limit || 10)
  },
})

// Get COC statistics for last 24 hours (OPTIMIZED)
export const getCocStats = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000

    // BATCH QUERY 1: Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    if (activeProjects.length === 0) return { total: 0, autoApproved: 0, needsReview: 0 }

    // BATCH QUERY 2: Get all documents for active projects in parallel
    const docsPromises = activeProjects.map((project) =>
      ctx.db
        .query("cocDocuments")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()
    )
    const docsArrays = await Promise.all(docsPromises)
    const allDocs = docsArrays.flat()

    // Filter to recent docs only
    const recentDocs = allDocs.filter((doc) => doc.receivedAt && doc.receivedAt >= yesterday)
    if (recentDocs.length === 0) return { total: 0, autoApproved: 0, needsReview: 0 }

    // BATCH QUERY 3: Get verifications for recent docs in parallel
    const verificationPromises = recentDocs.map((doc) =>
      ctx.db
        .query("verifications")
        .withIndex("by_document", (q) => q.eq("cocDocumentId", doc._id))
        .first()
    )
    const verificationsArray = await Promise.all(verificationPromises)

    // Count in memory
    let total = recentDocs.length
    let autoApproved = 0
    let needsReview = 0

    for (const verification of verificationsArray) {
      if (verification?.status === "pass") {
        autoApproved++
      } else {
        needsReview++
      }
    }

    return { total, autoApproved, needsReview }
  },
})

// Get pending responses - failed verifications awaiting response (OPTIMIZED)
export const getPendingResponses = query({
  args: {
    companyId: v.id("companies"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // BATCH QUERY 1: Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    if (activeProjects.length === 0) return []

    const projectMap = new Map(activeProjects.map((p) => [p._id, p]))
    const activeProjectIds = activeProjects.map((p) => p._id)

    // BATCH QUERY 2: Get all verifications for active projects in parallel
    const verificationsPromises = activeProjectIds.map((projectId) =>
      ctx.db
        .query("verifications")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect()
    )
    const verificationsArrays = await Promise.all(verificationsPromises)
    const allVerifications = verificationsArrays.flat()
    const failedVerifications = allVerifications.filter((v) => v.status === "fail")

    if (failedVerifications.length === 0) return []

    // BATCH QUERY 3: Get communications for failed verifications in parallel
    const commsPromises = failedVerifications.map((v) =>
      ctx.db
        .query("communications")
        .withIndex("by_verification", (q) => q.eq("verificationId", v._id))
        .collect()
    )
    const commsArrays = await Promise.all(commsPromises)
    const commsByVerificationMap = new Map<string, (typeof commsArrays)[number]>()
    for (let i = 0; i < failedVerifications.length; i++) {
      commsByVerificationMap.set(failedVerifications[i]._id, commsArrays[i])
    }

    // BATCH QUERY 4: Get all documents for failed verifications in parallel
    const docIds = Array.from(new Set(failedVerifications.map((v) => v.cocDocumentId)))
    const docPromises = docIds.map((id) =>
      ctx.db.get(id) as Promise<{
        _id: Id<"cocDocuments">
        _creationTime: number
        subcontractorId: Id<"subcontractors">
        projectId?: Id<"projects">
        fileName?: string
        fileUrl?: string
        receivedAt?: number
        processingStatus: string
      } | null>
    )
    const docsArray = await Promise.all(docPromises)
    const docMap = new Map(
      docsArray
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => [d._id, d])
    )

    // BATCH QUERY 5: Get all subcontractors we need
    const subcontractorIds = Array.from(new Set(
      docsArray
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => d.subcontractorId)
    ))
    const subcontractorPromises = subcontractorIds.map((id) => ctx.db.get(id))
    const subcontractorsArray = await Promise.all(subcontractorPromises)
    const subcontractorMap = new Map(
      subcontractorsArray
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s])
    )

    // BATCH QUERY 6: Get all docs by subcontractor+project for newer doc check
    // Build unique subcontractor+project combos from docs
    const subProjectCombos = new Set<string>()
    for (const doc of docsArray) {
      if (doc && doc.projectId) {
        subProjectCombos.add(`${doc.subcontractorId}:${doc.projectId}`)
      }
    }
    const comboDocsPromises = Array.from(subProjectCombos).map((combo) => {
      const [subId, projId] = combo.split(":") as [Id<"subcontractors">, Id<"projects">]
      return ctx.db
        .query("cocDocuments")
        .withIndex("by_subcontractor_project", (q) =>
          q.eq("subcontractorId", subId).eq("projectId", projId)
        )
        .collect()
    })
    const comboDocsArrays = await Promise.all(comboDocsPromises)
    const docsBySubProjectMap = new Map<string, (typeof comboDocsArrays)[number]>()
    const comboKeys = Array.from(subProjectCombos)
    for (let i = 0; i < comboKeys.length; i++) {
      docsBySubProjectMap.set(comboKeys[i], comboDocsArrays[i])
    }

    // Process in memory
    const pendingResponses: Array<{
      verification_id: string
      verification_status: string
      verification_date: string
      document_id: string
      file_name: string | null
      subcontractor_id: string
      subcontractor_name: string
      broker_email: string | null
      project_id: string
      project_name: string
      communication_id: string
      last_communication_date: string
      communication_type: string
      days_waiting: number
    }> = []

    for (const verification of failedVerifications) {
      const communications = commsByVerificationMap.get(verification._id) || []
      // Sort by sentAt desc
      communications.sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))

      const lastComm = communications.find((c) =>
        ["sent", "delivered", "opened"].includes(c.status)
      )
      if (!lastComm || !lastComm.sentAt) continue

      const doc = docMap.get(verification.cocDocumentId)
      if (!doc || !doc.projectId) continue

      const comboKey = `${doc.subcontractorId}:${doc.projectId}`
      const relatedDocs = docsBySubProjectMap.get(comboKey) || []
      const hasNewerDoc = relatedDocs.some(
        (d) => d.receivedAt && d.receivedAt > lastComm.sentAt!
      )
      if (hasNewerDoc) continue

      const subcontractor = subcontractorMap.get(doc.subcontractorId)
      if (!subcontractor) continue

      const project = projectMap.get(doc.projectId)
      if (!project) continue

      const daysWaiting = Math.floor(
        (Date.now() - lastComm.sentAt) / (1000 * 60 * 60 * 24)
      )

      pendingResponses.push({
        verification_id: verification._id,
        verification_status: verification.status,
        verification_date: new Date(verification._creationTime).toISOString(),
        document_id: doc._id,
        file_name: doc.fileName || null,
        subcontractor_id: subcontractor._id,
        subcontractor_name: subcontractor.name,
        broker_email: subcontractor.contactEmail || null,
        project_id: project._id,
        project_name: project.name,
        communication_id: lastComm._id,
        last_communication_date: new Date(lastComm.sentAt).toISOString(),
        communication_type: lastComm.type,
        days_waiting: daysWaiting,
      })
    }

    // Sort by days_waiting descending
    pendingResponses.sort((a, b) => b.days_waiting - a.days_waiting)

    return pendingResponses.slice(0, args.limit || 10)
  },
})

// Get morning brief - combined dashboard data (OPTIMIZED with parallel batched queries)
export const getMorningBrief = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const startTime = Date.now()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()
    const yesterday = Date.now() - 24 * 60 * 60 * 1000

    // STAGE 1: Get all projects for company (must be first - everything depends on this)
    const stage1Start = Date.now()
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()
    console.log(`[PERF] getMorningBrief Stage 1 (projects): ${Date.now() - stage1Start}ms, count: ${projects.length}`)

    const activeProjects = projects.filter((p) => p.status !== "completed")
    const activeProjectIds = activeProjects.map((p) => p._id)
    const projectMap = new Map(projects.map((p) => [p._id, p]))

    // Early return if no active projects
    if (activeProjects.length === 0) {
      return {
        stopWorkRisks: [],
        stats: {
          complianceRate: null,
          activeProjects: 0,
          pendingReviews: 0,
          stopWorkCount: 0,
          pendingResponsesCount: 0,
          total: 0,
          compliant: 0,
          non_compliant: 0,
          pending: 0,
          exception: 0,
        },
        newCocs: [],
        cocStats: { total: 0, autoApproved: 0, needsReview: 0 },
        pendingResponses: [],
      }
    }

    // STAGE 2: Run these queries in PARALLEL (all only need projectIds from stage 1)
    // - projectSubcontractors
    // - documents
    // - verifications
    const stage2Start = Date.now()
    const [projectSubsArrays, docsArrays, verificationsArrays] = await Promise.all([
      // Get projectSubcontractors for all active projects
      Promise.all(
        activeProjectIds.map((projectId) =>
          ctx.db
            .query("projectSubcontractors")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .collect()
        )
      ),
      // Get documents for all active projects (OPTIMIZED: filter by date at query level)
      // Only fetch documents from last 7 days to reduce data transfer
      Promise.all(
        activeProjectIds.map((projectId) =>
          ctx.db
            .query("cocDocuments")
            .withIndex("by_project_received", (q) =>
              q.eq("projectId", projectId).gte("receivedAt", yesterday)
            )
            .collect()
        )
      ),
      // Get verifications for all active projects
      Promise.all(
        activeProjectIds.map((projectId) =>
          ctx.db
            .query("verifications")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .collect()
        )
      ),
    ])
    console.log(`[PERF] getMorningBrief Stage 2 (subs/docs/verifications): ${Date.now() - stage2Start}ms, projects: ${activeProjectIds.length}`)

    // Flatten stage 2 results
    const projectSubs = projectSubsArrays.flat()
    const docs = docsArrays.flat()
    const verifications = verificationsArrays.flat()
    const docMap = new Map(docs.map((d) => [d._id, d]))
    const verificationByDocMap = new Map(
      verifications.map((v) => [v.cocDocumentId, v])
    )

    // Collect IDs needed for stage 3
    const subcontractorIds = new Set<Id<"subcontractors">>()
    for (const ps of projectSubs) {
      subcontractorIds.add(ps.subcontractorId)
    }
    const projectSubIds = projectSubs.map((ps) => ps._id)
    const failedVerifications = verifications.filter((v) => v.status === "fail")

    // STAGE 3: Run these queries in PARALLEL (depend on stage 2 results)
    // - subcontractors (needs subcontractorIds from projectSubs)
    // - exceptions (needs projectSubIds from projectSubs)
    // - communications (needs failedVerifications from verifications)
    const stage3Start = Date.now()
    const [subcontractorsArray, exceptionsArrays, commsArrays] = await Promise.all([
      // Get all subcontractors we need
      Promise.all(
        Array.from(subcontractorIds).map((id) => ctx.db.get(id))
      ),
      // Get exceptions for relevant project subcontractors
      Promise.all(
        projectSubIds.map((psId) =>
          ctx.db
            .query("exceptions")
            .withIndex("by_project_subcontractor", (q) =>
              q.eq("projectSubcontractorId", psId)
            )
            .collect()
        )
      ),
      // Get communications for failed verifications
      Promise.all(
        failedVerifications.map((v) =>
          ctx.db
            .query("communications")
            .withIndex("by_verification", (q) => q.eq("verificationId", v._id))
            .collect()
        )
      ),
    ])
    console.log(`[PERF] getMorningBrief Stage 3 (subs/exceptions/comms): ${Date.now() - stage3Start}ms, subcontractors: ${subcontractorIds.size}, projectSubs: ${projectSubIds.length}`)

    // Process stage 3 results
    const subcontractorMap = new Map(
      subcontractorsArray
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s])
    )

    const allExceptions = exceptionsArrays.flat()
    const exceptionCountMap = new Map<string, number>()
    for (const exc of allExceptions) {
      if (exc.status === "active") {
        const key = exc.projectSubcontractorId
        exceptionCountMap.set(key, (exceptionCountMap.get(key) || 0) + 1)
      }
    }

    const commsByVerificationMap = new Map<
      string,
      (typeof commsArrays)[number]
    >()
    for (let i = 0; i < failedVerifications.length; i++) {
      commsByVerificationMap.set(failedVerifications[i]._id, commsArrays[i])
    }

    // Now process everything in memory (no more queries in loops!)

    // Initialize counters
    let total = 0
    let compliant = 0
    let nonCompliant = 0
    let pending = 0
    let exception = 0
    let pendingReviews = 0 // Verifications with status="review" (human review needed)
    let cocTotal = 0
    let cocAutoApproved = 0
    let cocNeedsReview = 0

    // Count verifications with status="review" (human review pending)
    for (const v of verifications) {
      if (v.status === "review") {
        pendingReviews++
      }
    }

    const stopWorkRisks: Array<{
      id: string
      status: string
      on_site_date: string | null
      project_id: string
      project_name: string
      subcontractor_id: string
      subcontractor_name: string
      subcontractor_abn: string
      active_exceptions: number
    }> = []

    const newCocs: Array<{
      id: string
      file_name: string | null
      received_at: string
      processing_status: string
      subcontractor_name: string
      project_name: string
      verification_status: string | null
    }> = []

    const pendingResponses: Array<{
      verification_id: string
      verification_status: string
      verification_date: string
      document_id: string
      file_name: string | null
      subcontractor_id: string
      subcontractor_name: string
      broker_email: string | null
      project_id: string
      project_name: string
      communication_id: string
      last_communication_date: string
      communication_type: string
      days_waiting: number
    }> = []

    // Process projectSubcontractors (all in memory)
    for (const ps of projectSubs) {
      total++
      if (ps.status === "compliant") compliant++
      else if (ps.status === "non_compliant") nonCompliant++
      else if (ps.status === "pending") pending++
      else if (ps.status === "exception") exception++

      // Check for stop work risk
      if (ps.onSiteDate && ["non_compliant", "pending"].includes(ps.status)) {
        const onSiteTimestamp = new Date(ps.onSiteDate).getTime()
        if (onSiteTimestamp <= todayTimestamp) {
          const subcontractor = subcontractorMap.get(ps.subcontractorId)
          const project = projectMap.get(ps.projectId)
          if (subcontractor && project) {
            const activeExceptions = exceptionCountMap.get(ps._id) || 0

            stopWorkRisks.push({
              id: ps._id,
              status: ps.status,
              on_site_date: ps.onSiteDate
                ? new Date(ps.onSiteDate).toISOString().split("T")[0]
                : null,
              project_id: project._id,
              project_name: project.name,
              subcontractor_id: subcontractor._id,
              subcontractor_name: subcontractor.name,
              subcontractor_abn: subcontractor.abn,
              active_exceptions: activeExceptions,
            })
          }
        }
      }
    }

    // Process documents (all in memory)
    for (const doc of docs) {
      // Check if new (last 24 hours)
      if (doc.receivedAt && doc.receivedAt >= yesterday) {
        const subcontractor = subcontractorMap.get(doc.subcontractorId)
        const verification = verificationByDocMap.get(doc._id)
        const project = doc.projectId ? projectMap.get(doc.projectId) : null

        cocTotal++
        if (verification?.status === "pass") {
          cocAutoApproved++
        } else {
          cocNeedsReview++
        }

        if (newCocs.length < 10 && project) {
          newCocs.push({
            id: doc._id,
            file_name: doc.fileName || null,
            received_at: new Date(doc.receivedAt).toISOString(),
            processing_status: doc.processingStatus,
            subcontractor_name: subcontractor?.name || "Unknown",
            project_name: project.name,
            verification_status: verification?.status || null,
          })
        }
      }
    }

    // Build docs by subcontractor+project for newer doc check
    const docsBySubProject = new Map<string, typeof docs>()
    for (const doc of docs) {
      if (doc.projectId) {
        const key = `${doc.subcontractorId}:${doc.projectId}`
        const existing = docsBySubProject.get(key) || []
        existing.push(doc)
        docsBySubProject.set(key, existing)
      }
    }

    // Process failed verifications for pending responses (all in memory)
    for (const verification of verifications.filter((v) => v.status === "fail")) {
      const communications = commsByVerificationMap.get(verification._id) || []
      // Sort by sentAt desc
      communications.sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))

      const lastComm = communications.find((c) =>
        ["sent", "delivered", "opened"].includes(c.status)
      )
      if (!lastComm || !lastComm.sentAt) continue

      const doc = docMap.get(verification.cocDocumentId)
      if (!doc || !doc.projectId) continue

      const key = `${doc.subcontractorId}:${doc.projectId}`
      const relatedDocs = docsBySubProject.get(key) || []
      const hasNewerDoc = relatedDocs.some(
        (d) => d.receivedAt && d.receivedAt > lastComm.sentAt!
      )
      if (hasNewerDoc) continue

      const subcontractor = subcontractorMap.get(doc.subcontractorId)
      if (!subcontractor) continue

      const project = projectMap.get(doc.projectId)
      if (!project) continue

      const daysWaiting = Math.floor(
        (Date.now() - lastComm.sentAt) / (1000 * 60 * 60 * 24)
      )

      pendingResponses.push({
        verification_id: verification._id,
        verification_status: verification.status,
        verification_date: new Date(verification._creationTime).toISOString(),
        document_id: doc._id,
        file_name: doc.fileName || null,
        subcontractor_id: subcontractor._id,
        subcontractor_name: subcontractor.name,
        broker_email: subcontractor.contactEmail || null,
        project_id: project._id,
        project_name: project.name,
        communication_id: lastComm._id,
        last_communication_date: new Date(lastComm.sentAt).toISOString(),
        communication_type: lastComm.type,
        days_waiting: daysWaiting,
      })
    }

    // Sort arrays
    stopWorkRisks.sort((a, b) => {
      if (!a.on_site_date && !b.on_site_date) return 0
      if (!a.on_site_date) return 1
      if (!b.on_site_date) return -1
      return (
        new Date(a.on_site_date).getTime() - new Date(b.on_site_date).getTime()
      )
    })

    newCocs.sort(
      (a, b) =>
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    )

    pendingResponses.sort((a, b) => b.days_waiting - a.days_waiting)

    const complianceRate =
      total > 0 ? Math.round(((compliant + exception) / total) * 100) : null

    console.log(`[PERF] getMorningBrief TOTAL: ${Date.now() - startTime}ms`)

    return {
      stopWorkRisks,
      stats: {
        complianceRate,
        activeProjects: activeProjects.length,
        pendingReviews,
        stopWorkCount: stopWorkRisks.length,
        pendingResponsesCount: pendingResponses.length,
        total,
        compliant,
        non_compliant: nonCompliant,
        pending,
        exception,
      },
      newCocs,
      cocStats: {
        total: cocTotal,
        autoApproved: cocAutoApproved,
        needsReview: cocNeedsReview,
      },
      pendingResponses: pendingResponses.slice(0, 10),
    }
  },
})

// Get subcontractor for critical alert
export const getSubcontractorForAlert = query({
  args: {
    subcontractorId: v.id("subcontractors"),
    projectId: v.id("projects"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    // Verify project belongs to company
    const project = await ctx.db.get(args.projectId)
    if (!project || project.companyId !== args.companyId) return null

    // Get subcontractor
    const subcontractor = await ctx.db.get(args.subcontractorId)
    if (!subcontractor) return null

    // Get project_subcontractor link
    const ps = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project_subcontractor", (q) =>
        q.eq("projectId", args.projectId).eq("subcontractorId", args.subcontractorId)
      )
      .first()

    if (!ps) return null

    return {
      id: subcontractor._id,
      name: subcontractor.name,
      abn: subcontractor.abn,
      contact_name: subcontractor.contactName || null,
      contact_email: subcontractor.contactEmail || null,
      contact_phone: subcontractor.contactPhone || null,
      broker_email: subcontractor.brokerEmail || null,
      broker_phone: subcontractor.brokerPhone || null,
      status: ps.status,
      on_site_date: ps.onSiteDate
        ? new Date(ps.onSiteDate).toISOString().split("T")[0]
        : null,
    }
  },
})

// Get alert recipients (project manager and admins)
export const getAlertRecipients = query({
  args: {
    companyId: v.id("companies"),
    projectManagerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    return users
      .filter(
        (u) => u.role === "admin" || u._id === args.projectManagerId
      )
      .map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || null,
        role: u.role,
      }))
  },
})

// Get pending follow-ups - verifications that need follow-up emails (OPTIMIZED)
export const getPendingFollowups = query({
  args: {
    companyId: v.id("companies"),
    minDaysWaiting: v.optional(v.number()),
    maxFollowups: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const minDays = args.minDaysWaiting || 2
    const maxFollowups = args.maxFollowups || 10
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

    // BATCH QUERY 1: Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    if (activeProjects.length === 0) return []

    const projectMap = new Map(activeProjects.map((p) => [p._id, p]))
    const activeProjectIds = activeProjects.map((p) => p._id)

    // BATCH QUERY 2: Get all verifications for active projects in parallel
    const verificationsPromises = activeProjectIds.map((projectId) =>
      ctx.db
        .query("verifications")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect()
    )
    const verificationsArrays = await Promise.all(verificationsPromises)
    const failedVerifications = verificationsArrays.flat().filter((v) => v.status === "fail")

    if (failedVerifications.length === 0) return []

    // BATCH QUERY 3: Get communications for failed verifications in parallel
    const commsPromises = failedVerifications.map((v) =>
      ctx.db
        .query("communications")
        .withIndex("by_verification", (q) => q.eq("verificationId", v._id))
        .collect()
    )
    const commsArrays = await Promise.all(commsPromises)
    const commsByVerificationMap = new Map<string, (typeof commsArrays)[number]>()
    for (let i = 0; i < failedVerifications.length; i++) {
      commsByVerificationMap.set(failedVerifications[i]._id, commsArrays[i])
    }

    // BATCH QUERY 4: Get all documents for failed verifications in parallel
    const docIds = Array.from(new Set(failedVerifications.map((v) => v.cocDocumentId)))
    const docPromises = docIds.map((id) =>
      ctx.db.get(id) as Promise<{
        _id: Id<"cocDocuments">
        _creationTime: number
        subcontractorId: Id<"subcontractors">
        projectId?: Id<"projects">
        fileName?: string
        receivedAt?: number
        processingStatus: string
      } | null>
    )
    const docsArray = await Promise.all(docPromises)
    const docMap = new Map(
      docsArray
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => [d._id, d])
    )

    // BATCH QUERY 5: Get all subcontractors we need
    const subcontractorIds = Array.from(new Set(
      docsArray.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => d.subcontractorId)
    ))
    const subcontractorPromises = subcontractorIds.map((id) => ctx.db.get(id))
    const subcontractorsArray = await Promise.all(subcontractorPromises)
    const subcontractorMap = new Map(
      subcontractorsArray
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s])
    )

    // BATCH QUERY 6: Get all docs by subcontractor+project for newer doc check
    const subProjectCombos = new Set<string>()
    for (const doc of docsArray) {
      if (doc && doc.projectId) {
        subProjectCombos.add(`${doc.subcontractorId}:${doc.projectId}`)
      }
    }
    const comboDocsPromises = Array.from(subProjectCombos).map((combo) => {
      const [subId, projId] = combo.split(":") as [Id<"subcontractors">, Id<"projects">]
      return ctx.db
        .query("cocDocuments")
        .withIndex("by_subcontractor_project", (q) =>
          q.eq("subcontractorId", subId).eq("projectId", projId)
        )
        .collect()
    })
    const comboDocsArrays = await Promise.all(comboDocsPromises)
    const docsBySubProjectMap = new Map<string, (typeof comboDocsArrays)[number]>()
    const comboKeys = Array.from(subProjectCombos)
    for (let i = 0; i < comboKeys.length; i++) {
      docsBySubProjectMap.set(comboKeys[i], comboDocsArrays[i])
    }

    // Process in memory
    const pendingFollowups: Array<{
      verification_id: string
      deficiencies: string
      document_id: string
      file_name: string | null
      subcontractor_id: string
      subcontractor_name: string
      contact_email: string | null
      broker_email: string | null
      project_id: string
      project_name: string
      last_communication_id: string
      last_sent_at: string
      last_type: string
      days_since_last: number
    }> = []

    for (const verification of failedVerifications) {
      const communications = commsByVerificationMap.get(verification._id) || []
      communications.sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))

      const lastComm = communications.find(
        (c) =>
          ["sent", "delivered", "opened"].includes(c.status) &&
          ["deficiency", "follow_up"].includes(c.type)
      )
      if (!lastComm || !lastComm.sentAt) continue

      const recentFollowup = communications.find(
        (c) => c.type === "follow_up" && c.sentAt && c.sentAt > oneDayAgo
      )
      if (recentFollowup) continue

      const daysSinceLast = (Date.now() - lastComm.sentAt) / (1000 * 60 * 60 * 24)
      if (daysSinceLast < minDays) continue

      const doc = docMap.get(verification.cocDocumentId)
      if (!doc || !doc.projectId) continue

      const comboKey = `${doc.subcontractorId}:${doc.projectId}`
      const relatedDocs = docsBySubProjectMap.get(comboKey) || []
      const hasNewerDoc = relatedDocs.some(
        (d) => d.receivedAt && d.receivedAt > lastComm.sentAt!
      )
      if (hasNewerDoc) continue

      const subcontractor = subcontractorMap.get(doc.subcontractorId)
      if (!subcontractor) continue

      const project = projectMap.get(doc.projectId)
      if (!project) continue

      pendingFollowups.push({
        verification_id: verification._id,
        deficiencies: JSON.stringify(verification.deficiencies || []),
        document_id: doc._id,
        file_name: doc.fileName || null,
        subcontractor_id: subcontractor._id,
        subcontractor_name: subcontractor.name,
        contact_email: subcontractor.contactEmail || null,
        broker_email: subcontractor.brokerEmail || null,
        project_id: project._id,
        project_name: project.name,
        last_communication_id: lastComm._id,
        last_sent_at: new Date(lastComm.sentAt).toISOString(),
        last_type: lastComm.type,
        days_since_last: daysSinceLast,
      })
    }

    // Sort by days_since_last descending
    pendingFollowups.sort((a, b) => b.days_since_last - a.days_since_last)

    return pendingFollowups.slice(0, maxFollowups)
  },
})

// Get follow-up preview (what would be sent) (OPTIMIZED)
export const getFollowupPreview = query({
  args: {
    companyId: v.id("companies"),
    minDaysWaiting: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const minDays = args.minDaysWaiting || 2

    // BATCH QUERY 1: Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    if (activeProjects.length === 0) {
      return { wouldGetFollowup: [], notYetDue: [], summary: { wouldSend: 0, notYetDue: 0, total: 0 } }
    }

    const projectMap = new Map(activeProjects.map((p) => [p._id, p]))
    const activeProjectIds = activeProjects.map((p) => p._id)

    // BATCH QUERY 2: Get all verifications for active projects in parallel
    const verificationsPromises = activeProjectIds.map((projectId) =>
      ctx.db
        .query("verifications")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect()
    )
    const verificationsArrays = await Promise.all(verificationsPromises)
    const failedVerifications = verificationsArrays.flat().filter((v) => v.status === "fail")

    if (failedVerifications.length === 0) {
      return { wouldGetFollowup: [], notYetDue: [], summary: { wouldSend: 0, notYetDue: 0, total: 0 } }
    }

    // BATCH QUERY 3: Get communications for failed verifications in parallel
    const commsPromises = failedVerifications.map((v) =>
      ctx.db
        .query("communications")
        .withIndex("by_verification", (q) => q.eq("verificationId", v._id))
        .collect()
    )
    const commsArrays = await Promise.all(commsPromises)
    const commsByVerificationMap = new Map<string, (typeof commsArrays)[number]>()
    for (let i = 0; i < failedVerifications.length; i++) {
      commsByVerificationMap.set(failedVerifications[i]._id, commsArrays[i])
    }

    // BATCH QUERY 4: Get all documents for failed verifications in parallel
    const docIds = Array.from(new Set(failedVerifications.map((v) => v.cocDocumentId)))
    const docPromises = docIds.map((id) =>
      ctx.db.get(id) as Promise<{
        _id: Id<"cocDocuments">
        subcontractorId: Id<"subcontractors">
        projectId?: Id<"projects">
      } | null>
    )
    const docsArray = await Promise.all(docPromises)
    const docMap = new Map(
      docsArray
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => [d._id, d])
    )

    // BATCH QUERY 5: Get all subcontractors we need
    const subcontractorIds = Array.from(new Set(
      docsArray.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => d.subcontractorId)
    ))
    const subcontractorPromises = subcontractorIds.map((id) => ctx.db.get(id))
    const subcontractorsArray = await Promise.all(subcontractorPromises)
    const subcontractorMap = new Map(
      subcontractorsArray
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s])
    )

    // BATCH QUERY 6: Get all docs by subcontractor+project for newer doc check
    const subProjectCombos = new Set<string>()
    for (const doc of docsArray) {
      if (doc && doc.projectId) {
        subProjectCombos.add(`${doc.subcontractorId}:${doc.projectId}`)
      }
    }
    const comboDocsPromises = Array.from(subProjectCombos).map((combo) => {
      const [subId, projId] = combo.split(":") as [Id<"subcontractors">, Id<"projects">]
      return ctx.db
        .query("cocDocuments")
        .withIndex("by_subcontractor_project", (q) =>
          q.eq("subcontractorId", subId).eq("projectId", projId)
        )
        .collect()
    })
    const comboDocsArrays = await Promise.all(comboDocsPromises)
    const docsBySubProjectMap = new Map<string, (typeof comboDocsArrays)[number]>()
    const comboKeys = Array.from(subProjectCombos)
    for (let i = 0; i < comboKeys.length; i++) {
      docsBySubProjectMap.set(comboKeys[i], comboDocsArrays[i])
    }

    // Process in memory
    const wouldGetFollowup: Array<{
      subcontractorName: string
      projectName: string
      daysWaiting: number
      followUpCount: number
      recipientEmail: string | null
    }> = []

    const notYetDue: Array<{
      subcontractorName: string
      projectName: string
      daysWaiting: number
      daysUntilFollowup: number
    }> = []

    for (const verification of failedVerifications) {
      const communications = commsByVerificationMap.get(verification._id) || []
      communications.sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))

      const lastComm = communications.find(
        (c) =>
          ["sent", "delivered", "opened"].includes(c.status) &&
          ["deficiency", "follow_up"].includes(c.type)
      )
      if (!lastComm || !lastComm.sentAt) continue

      const doc = docMap.get(verification.cocDocumentId)
      if (!doc || !doc.projectId) continue

      const comboKey = `${doc.subcontractorId}:${doc.projectId}`
      const relatedDocs = docsBySubProjectMap.get(comboKey) || []
      const hasNewerDoc = relatedDocs.some(
        (d) => d.receivedAt && d.receivedAt > lastComm.sentAt!
      )
      if (hasNewerDoc) continue

      const subcontractor = subcontractorMap.get(doc.subcontractorId)
      if (!subcontractor) continue

      const project = projectMap.get(doc.projectId)
      if (!project) continue

      const daysSinceLast = (Date.now() - lastComm.sentAt) / (1000 * 60 * 60 * 24)
      const followUpCount = communications.filter((c) => c.type === "follow_up").length

      if (daysSinceLast >= minDays) {
        wouldGetFollowup.push({
          subcontractorName: subcontractor.name,
          projectName: project.name,
          daysWaiting: Math.floor(daysSinceLast),
          followUpCount,
          recipientEmail: subcontractor.brokerEmail || subcontractor.contactEmail || null,
        })
      } else {
        notYetDue.push({
          subcontractorName: subcontractor.name,
          projectName: project.name,
          daysWaiting: Math.floor(daysSinceLast),
          daysUntilFollowup: Math.ceil(minDays - daysSinceLast),
        })
      }
    }

    return {
      wouldGetFollowup,
      notYetDue,
      summary: {
        wouldSend: wouldGetFollowup.length,
        notYetDue: notYetDue.length,
        total: wouldGetFollowup.length + notYetDue.length,
      },
    }
  },
})
