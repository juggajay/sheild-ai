import { v } from "convex/values"
import { query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Get stop work risks - subcontractors on-site today/past with non-compliant status
export const getStopWorkRisks = query({
  args: {
    companyId: v.id("companies"),
    includeExceptionCount: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()

    // Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    const projectMap = new Map(activeProjects.map((p) => [p._id, p]))

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

    for (const project of activeProjects) {
      // Get project_subcontractors for this project
      const projectSubs = await ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const ps of projectSubs) {
        // Check if on-site date is today or past and status is non-compliant
        if (!ps.onSiteDate) continue

        const onSiteTimestamp = new Date(ps.onSiteDate).getTime()
        if (onSiteTimestamp > todayTimestamp) continue

        if (!["non_compliant", "pending"].includes(ps.status)) continue

        const subcontractor = await ctx.db.get(ps.subcontractorId)
        if (!subcontractor) continue

        let activeExceptions = 0
        if (args.includeExceptionCount) {
          const exceptions = await ctx.db
            .query("exceptions")
            .withIndex("by_project_subcontractor", (q) =>
              q.eq("projectSubcontractorId", ps._id)
            )
            .collect()
          activeExceptions = exceptions.filter(
            (e) => e.status === "active"
          ).length
        }

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
            active_exceptions: activeExceptions,
          }),
        })
      }
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

// Get compliance statistics for active projects
export const getComplianceStats = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")

    let total = 0
    let compliant = 0
    let nonCompliant = 0
    let pending = 0
    let exception = 0

    for (const project of activeProjects) {
      const projectSubs = await ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const ps of projectSubs) {
        total++
        if (ps.status === "compliant") compliant++
        else if (ps.status === "non_compliant") nonCompliant++
        else if (ps.status === "pending") pending++
        else if (ps.status === "exception") exception++
      }
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

// Get pending document reviews count
export const getPendingReviewsCount = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")

    let count = 0
    for (const project of activeProjects) {
      const docs = await ctx.db
        .query("cocDocuments")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      count += docs.filter((d) => d.processingStatus === "pending").length
    }

    return count
  },
})

// Get new COCs received in last 24 hours
export const getNewCocs = query({
  args: {
    companyId: v.id("companies"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000

    // Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    const projectMap = new Map(activeProjects.map((p) => [p._id, p]))

    const newCocs: Array<{
      id: string
      file_name: string | null
      received_at: string
      processing_status: string
      subcontractor_name: string
      project_name: string
      verification_status: string | null
    }> = []

    for (const project of activeProjects) {
      const docs = await ctx.db
        .query("cocDocuments")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const doc of docs) {
        if (!doc.receivedAt || doc.receivedAt < yesterday) continue

        const subcontractor = await ctx.db.get(doc.subcontractorId)
        const verification = await ctx.db
          .query("verifications")
          .withIndex("by_document", (q) => q.eq("cocDocumentId", doc._id))
          .first()

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

    // Sort by received_at descending
    newCocs.sort(
      (a, b) =>
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    )

    return newCocs.slice(0, args.limit || 10)
  },
})

// Get COC statistics for last 24 hours
export const getCocStats = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000

    // Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")

    let total = 0
    let autoApproved = 0
    let needsReview = 0

    for (const project of activeProjects) {
      const docs = await ctx.db
        .query("cocDocuments")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const doc of docs) {
        if (!doc.receivedAt || doc.receivedAt < yesterday) continue

        total++

        const verification = await ctx.db
          .query("verifications")
          .withIndex("by_document", (q) => q.eq("cocDocumentId", doc._id))
          .first()

        if (verification?.status === "pass") {
          autoApproved++
        } else {
          needsReview++
        }
      }
    }

    return {
      total,
      autoApproved,
      needsReview,
    }
  },
})

// Get pending responses - failed verifications awaiting response
export const getPendingResponses = query({
  args: {
    companyId: v.id("companies"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")

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

    for (const project of activeProjects) {
      // Get failed verifications
      const verifications = await ctx.db
        .query("verifications")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      const failedVerifications = verifications.filter(
        (v) => v.status === "fail"
      )

      for (const verification of failedVerifications) {
        // Get the last communication for this verification
        const communications = await ctx.db
          .query("communications")
          .withIndex("by_verification", (q) =>
            q.eq("verificationId", verification._id)
          )
          .order("desc")
          .collect()

        const lastComm = communications.find((c) =>
          ["sent", "delivered", "opened"].includes(c.status)
        )
        if (!lastComm || !lastComm.sentAt) continue

        // Check if a newer COC was uploaded after the communication
        const doc = await ctx.db.get(verification.cocDocumentId)
        if (!doc) continue

        const newerDocs = await ctx.db
          .query("cocDocuments")
          .withIndex("by_subcontractor_project", (q) =>
            q
              .eq("subcontractorId", doc.subcontractorId)
              .eq("projectId", project._id)
          )
          .collect()

        const hasNewerDoc = newerDocs.some(
          (d) => d.receivedAt && d.receivedAt > lastComm.sentAt!
        )
        if (hasNewerDoc) continue

        const subcontractor = await ctx.db.get(doc.subcontractorId)
        if (!subcontractor) continue

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
    }

    // Sort by days_waiting descending
    pendingResponses.sort((a, b) => b.days_waiting - a.days_waiting)

    return pendingResponses.slice(0, args.limit || 10)
  },
})

// Get morning brief - combined dashboard data
export const getMorningBrief = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()
    const yesterday = Date.now() - 24 * 60 * 60 * 1000

    // Initialize counters
    let total = 0
    let compliant = 0
    let nonCompliant = 0
    let pending = 0
    let exception = 0
    let pendingReviews = 0
    let cocTotal = 0
    let cocAutoApproved = 0
    let cocNeedsReview = 0

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

    for (const project of activeProjects) {
      // Get project_subcontractors
      const projectSubs = await ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const ps of projectSubs) {
        total++
        if (ps.status === "compliant") compliant++
        else if (ps.status === "non_compliant") nonCompliant++
        else if (ps.status === "pending") pending++
        else if (ps.status === "exception") exception++

        // Check for stop work risk
        if (
          ps.onSiteDate &&
          ["non_compliant", "pending"].includes(ps.status)
        ) {
          const onSiteTimestamp = new Date(ps.onSiteDate).getTime()
          if (onSiteTimestamp <= todayTimestamp) {
            const subcontractor = await ctx.db.get(ps.subcontractorId)
            if (subcontractor) {
              const exceptions = await ctx.db
                .query("exceptions")
                .withIndex("by_project_subcontractor", (q) =>
                  q.eq("projectSubcontractorId", ps._id)
                )
                .collect()
              const activeExceptions = exceptions.filter(
                (e) => e.status === "active"
              ).length

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

      // Get documents and verifications
      const docs = await ctx.db
        .query("cocDocuments")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const doc of docs) {
        if (doc.processingStatus === "pending") pendingReviews++

        // Check if new (last 24 hours)
        if (doc.receivedAt && doc.receivedAt >= yesterday) {
          const subcontractor = await ctx.db.get(doc.subcontractorId)
          const verification = await ctx.db
            .query("verifications")
            .withIndex("by_document", (q) => q.eq("cocDocumentId", doc._id))
            .first()

          cocTotal++
          if (verification?.status === "pass") {
            cocAutoApproved++
          } else {
            cocNeedsReview++
          }

          if (newCocs.length < 10) {
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

      // Get failed verifications for pending responses
      const verifications = await ctx.db
        .query("verifications")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const verification of verifications.filter(
        (v) => v.status === "fail"
      )) {
        const communications = await ctx.db
          .query("communications")
          .withIndex("by_verification", (q) =>
            q.eq("verificationId", verification._id)
          )
          .order("desc")
          .collect()

        const lastComm = communications.find((c) =>
          ["sent", "delivered", "opened"].includes(c.status)
        )
        if (!lastComm || !lastComm.sentAt) continue

        const doc = await ctx.db.get(verification.cocDocumentId)
        if (!doc) continue

        const newerDocs = await ctx.db
          .query("cocDocuments")
          .withIndex("by_subcontractor_project", (q) =>
            q
              .eq("subcontractorId", doc.subcontractorId)
              .eq("projectId", project._id)
          )
          .collect()

        const hasNewerDoc = newerDocs.some(
          (d) => d.receivedAt && d.receivedAt > lastComm.sentAt!
        )
        if (hasNewerDoc) continue

        const subcontractor = await ctx.db.get(doc.subcontractorId)
        if (!subcontractor) continue

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

// Get pending follow-ups - verifications that need follow-up emails
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

    // Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")

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

    for (const project of activeProjects) {
      // Get failed verifications
      const verifications = await ctx.db
        .query("verifications")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const verification of verifications.filter(
        (v) => v.status === "fail"
      )) {
        // Get communications for this verification
        const communications = await ctx.db
          .query("communications")
          .withIndex("by_verification", (q) =>
            q.eq("verificationId", verification._id)
          )
          .order("desc")
          .collect()

        // Find the last deficiency/follow_up communication that was sent
        const lastComm = communications.find(
          (c) =>
            ["sent", "delivered", "opened"].includes(c.status) &&
            ["deficiency", "follow_up"].includes(c.type)
        )
        if (!lastComm || !lastComm.sentAt) continue

        // Check if already sent a follow-up in last 24 hours
        const recentFollowup = communications.find(
          (c) =>
            c.type === "follow_up" && c.sentAt && c.sentAt > oneDayAgo
        )
        if (recentFollowup) continue

        const daysSinceLast = (Date.now() - lastComm.sentAt) / (1000 * 60 * 60 * 24)
        if (daysSinceLast < minDays) continue

        // Check if a newer COC was uploaded
        const doc = await ctx.db.get(verification.cocDocumentId)
        if (!doc) continue

        const newerDocs = await ctx.db
          .query("cocDocuments")
          .withIndex("by_subcontractor_project", (q) =>
            q
              .eq("subcontractorId", doc.subcontractorId)
              .eq("projectId", project._id)
          )
          .collect()

        const hasNewerDoc = newerDocs.some(
          (d) => d.receivedAt && d.receivedAt > lastComm.sentAt!
        )
        if (hasNewerDoc) continue

        const subcontractor = await ctx.db.get(doc.subcontractorId)
        if (!subcontractor) continue

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
    }

    // Sort by days_since_last descending
    pendingFollowups.sort((a, b) => b.days_since_last - a.days_since_last)

    return pendingFollowups.slice(0, maxFollowups)
  },
})

// Get follow-up preview (what would be sent)
export const getFollowupPreview = query({
  args: {
    companyId: v.id("companies"),
    minDaysWaiting: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const minDays = args.minDaysWaiting || 2

    // Get all active projects for company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeProjects = projects.filter((p) => p.status !== "completed")

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

    for (const project of activeProjects) {
      // Get failed verifications
      const verifications = await ctx.db
        .query("verifications")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const verification of verifications.filter(
        (v) => v.status === "fail"
      )) {
        // Get communications for this verification
        const communications = await ctx.db
          .query("communications")
          .withIndex("by_verification", (q) =>
            q.eq("verificationId", verification._id)
          )
          .order("desc")
          .collect()

        const lastComm = communications.find(
          (c) =>
            ["sent", "delivered", "opened"].includes(c.status) &&
            ["deficiency", "follow_up"].includes(c.type)
        )
        if (!lastComm || !lastComm.sentAt) continue

        // Check if newer COC uploaded
        const doc = await ctx.db.get(verification.cocDocumentId)
        if (!doc) continue

        const newerDocs = await ctx.db
          .query("cocDocuments")
          .withIndex("by_subcontractor_project", (q) =>
            q
              .eq("subcontractorId", doc.subcontractorId)
              .eq("projectId", project._id)
          )
          .collect()

        const hasNewerDoc = newerDocs.some(
          (d) => d.receivedAt && d.receivedAt > lastComm.sentAt!
        )
        if (hasNewerDoc) continue

        const subcontractor = await ctx.db.get(doc.subcontractorId)
        if (!subcontractor) continue

        const daysSinceLast = (Date.now() - lastComm.sentAt) / (1000 * 60 * 60 * 24)
        const followUpCount = communications.filter(
          (c) => c.type === "follow_up"
        ).length

        if (daysSinceLast >= minDays) {
          wouldGetFollowup.push({
            subcontractorName: subcontractor.name,
            projectName: project.name,
            daysWaiting: Math.floor(daysSinceLast),
            followUpCount,
            recipientEmail:
              subcontractor.brokerEmail || subcontractor.contactEmail || null,
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
