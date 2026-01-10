import { v } from "convex/values"
import { query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Get builders for portal user (subcontractor view)
export const getBuilders = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    // Find all subcontractor records that match the portal user's email
    // A subcontractor might work with multiple builders (companies)
    const allSubcontractors = await ctx.db.query("subcontractors").collect()
    const subcontractorRecords = allSubcontractors.filter(
      (s) => s.contactEmail?.toLowerCase() === args.userEmail.toLowerCase()
    )

    if (subcontractorRecords.length === 0) {
      return {
        builders: [],
        summary: {
          totalBuilders: 0,
          compliant: 0,
          actionRequired: 0,
          expiringSoon: 0,
        },
      }
    }

    const builders = await Promise.all(
      subcontractorRecords.map(async (subcontractor) => {
        // Get company info
        const company = await ctx.db.get(subcontractor.companyId)

        // Get project subcontractors for this subcontractor
        const projectSubs = await ctx.db
          .query("projectSubcontractors")
          .withIndex("by_subcontractor", (q) =>
            q.eq("subcontractorId", subcontractor._id)
          )
          .collect()

        const projects = await Promise.all(
          projectSubs.map(async (ps) => {
            const project = await ctx.db.get(ps.projectId)

            // Count deficiencies for this subcontractor/project
            const docs = await ctx.db
              .query("cocDocuments")
              .withIndex("by_subcontractor_project", (q) =>
                q.eq("subcontractorId", subcontractor._id).eq("projectId", ps.projectId)
              )
              .collect()

            let deficiencyCount = 0
            for (const doc of docs) {
              const verification = await ctx.db
                .query("verifications")
                .withIndex("by_document", (q) => q.eq("cocDocumentId", doc._id))
                .first()
              if (verification?.status === "fail") {
                deficiencyCount++
              }
            }

            return {
              id: project?._id || "",
              name: project?.name || "Unknown",
              status: project?.status || "active",
              complianceStatus: ps.status,
              onSiteDate: ps.onSiteDate
                ? new Date(ps.onSiteDate).toISOString().split("T")[0]
                : null,
              deficiencyCount,
            }
          })
        )

        // Calculate compliance summary
        const compliantProjects = projects.filter(
          (p) => p.complianceStatus === "compliant"
        ).length
        const nonCompliantProjects = projects.filter(
          (p) => p.complianceStatus === "non_compliant"
        ).length
        const pendingProjects = projects.filter(
          (p) => p.complianceStatus === "pending"
        ).length
        const totalDeficiencies = projects.reduce(
          (sum, p) => sum + p.deficiencyCount,
          0
        )

        // Count expiring certificates (within 30 days)
        const now = Date.now()
        const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000
        let expiringSoon = 0

        for (const ps of projectSubs) {
          const verifications = await ctx.db
            .query("verifications")
            .withIndex("by_project", (q) => q.eq("projectId", ps.projectId))
            .collect()

          for (const v of verifications) {
            if (v.status !== "pass") continue
            const extractedData = v.extractedData as Record<string, unknown> | null
            if (!extractedData) continue
            const expiryDateStr = extractedData.period_of_insurance_end as string
            if (!expiryDateStr) continue
            const expiryDate = new Date(expiryDateStr).getTime()
            if (expiryDate >= now && expiryDate <= thirtyDaysFromNow) {
              expiringSoon++
            }
          }
        }

        // Get outstanding deficiency requests
        const comms = await ctx.db
          .query("communications")
          .withIndex("by_subcontractor", (q) =>
            q.eq("subcontractorId", subcontractor._id)
          )
          .order("desc")
          .collect()

        const outstandingRequests: Array<{
          id: string
          type: string
          subject: string | null
          sentAt: string | null
          projectName: string | null
        }> = []

        for (const comm of comms.filter(
          (c) => c.type === "deficiency" && c.status === "sent"
        )) {
          // Check if a newer COC was uploaded
          const newerDocs = await ctx.db
            .query("cocDocuments")
            .withIndex("by_subcontractor_project", (q) =>
              q.eq("subcontractorId", subcontractor._id).eq("projectId", comm.projectId)
            )
            .collect()

          const hasNewerDoc = newerDocs.some(
            (d) => d._creationTime > comm._creationTime
          )

          if (!hasNewerDoc) {
            const project = await ctx.db.get(comm.projectId)
            outstandingRequests.push({
              id: comm._id,
              type: comm.type,
              subject: comm.subject || null,
              sentAt: comm.sentAt ? new Date(comm.sentAt).toISOString() : null,
              projectName: project?.name || null,
            })
          }

          if (outstandingRequests.length >= 5) break
        }

        const overallStatus =
          nonCompliantProjects > 0
            ? "action_required"
            : pendingProjects > 0
              ? "pending"
              : compliantProjects > 0
                ? "compliant"
                : "no_projects"

        return {
          id: company?._id || "",
          name: company?.name || "Unknown",
          subcontractorId: subcontractor._id,
          projects,
          summary: {
            totalProjects: projects.length,
            compliant: compliantProjects,
            nonCompliant: nonCompliantProjects,
            pending: pendingProjects,
            deficiencies: totalDeficiencies,
            expiringSoon,
          },
          outstandingRequests,
          overallStatus,
        }
      })
    )

    // Calculate overall summary
    const summary = {
      totalBuilders: builders.length,
      compliant: builders.filter((b) => b.overallStatus === "compliant").length,
      actionRequired: builders.filter((b) => b.overallStatus === "action_required")
        .length,
      expiringSoon: builders.reduce((sum, b) => sum + b.summary.expiringSoon, 0),
    }

    return { builders, summary }
  },
})

// Get clients for broker (broker view)
export const getBrokerClients = query({
  args: { brokerEmail: v.string() },
  handler: async (ctx, args) => {
    // Find all subcontractors where broker_email matches
    const allSubcontractors = await ctx.db.query("subcontractors").collect()
    const clients = allSubcontractors.filter(
      (s) => s.brokerEmail?.toLowerCase() === args.brokerEmail.toLowerCase()
    )

    const clientsWithStatus = await Promise.all(
      clients.map(async (client) => {
        const company = await ctx.db.get(client.companyId)

        // Get project subcontractors
        const projectSubs = await ctx.db
          .query("projectSubcontractors")
          .withIndex("by_subcontractor", (q) =>
            q.eq("subcontractorId", client._id)
          )
          .collect()

        const projects = await Promise.all(
          projectSubs.map(async (ps) => {
            const project = await ctx.db.get(ps.projectId)
            return {
              id: project?._id || "",
              name: project?.name || "Unknown",
              status: project?.status || "active",
              complianceStatus: ps.status,
            }
          })
        )

        // Count statuses
        const compliantCount = projects.filter(
          (p) => p.complianceStatus === "compliant"
        ).length
        const nonCompliantCount = projects.filter(
          (p) => p.complianceStatus === "non_compliant"
        ).length
        const pendingCount = projects.filter(
          (p) => p.complianceStatus === "pending"
        ).length
        const exceptionCount = projects.filter(
          (p) => p.complianceStatus === "exception"
        ).length

        // Get latest COC
        const docs = await ctx.db
          .query("cocDocuments")
          .withIndex("by_subcontractor", (q) =>
            q.eq("subcontractorId", client._id)
          )
          .order("desc")
          .take(1)

        let latestCoc = null
        if (docs.length > 0) {
          const doc = docs[0]
          const verification = await ctx.db
            .query("verifications")
            .withIndex("by_document", (q) => q.eq("cocDocumentId", doc._id))
            .first()

          latestCoc = {
            id: doc._id,
            fileName: doc.fileName || null,
            createdAt: new Date(doc._creationTime).toISOString(),
            status: verification?.status || null,
          }
        }

        // Calculate overall status
        let overallStatus: string
        if (nonCompliantCount > 0) {
          overallStatus = "non_compliant"
        } else if (exceptionCount > 0) {
          overallStatus = "exception"
        } else if (pendingCount > 0) {
          overallStatus = "pending"
        } else if (compliantCount > 0) {
          overallStatus = "compliant"
        } else {
          overallStatus = "no_projects"
        }

        return {
          id: client._id,
          name: client.name,
          abn: client.abn,
          tradingName: client.tradingName || null,
          trade: client.trade || null,
          contactName: client.contactName || null,
          contactEmail: client.contactEmail || null,
          contactPhone: client.contactPhone || null,
          builderId: company?._id || "",
          builderName: company?.name || "Unknown",
          projects,
          summary: {
            totalProjects: projects.length,
            compliant: compliantCount,
            nonCompliant: nonCompliantCount,
            pending: pendingCount,
            exception: exceptionCount,
          },
          latestCoc,
          overallStatus,
        }
      })
    )

    // Calculate summary across all clients
    const summary = {
      totalClients: clientsWithStatus.length,
      compliant: clientsWithStatus.filter((c) => c.overallStatus === "compliant")
        .length,
      nonCompliant: clientsWithStatus.filter(
        (c) => c.overallStatus === "non_compliant"
      ).length,
      pending: clientsWithStatus.filter((c) => c.overallStatus === "pending")
        .length,
      actionRequired: clientsWithStatus.filter((c) =>
        ["non_compliant", "exception"].includes(c.overallStatus)
      ).length,
    }

    return { clients: clientsWithStatus, summary }
  },
})

// Get subcontractor by broker email for validation
export const getSubcontractorByBrokerEmail = query({
  args: {
    subcontractorId: v.id("subcontractors"),
    brokerEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const subcontractor = await ctx.db.get(args.subcontractorId)
    if (!subcontractor) return null
    if (subcontractor.brokerEmail?.toLowerCase() !== args.brokerEmail.toLowerCase()) {
      return null
    }
    return subcontractor
  },
})

// Get project for subcontractor validation
export const getProjectForSubcontractor = query({
  args: {
    projectId: v.id("projects"),
    subcontractorId: v.id("subcontractors"),
  },
  handler: async (ctx, args) => {
    const projectSub = await ctx.db
      .query("projectSubcontractors")
      .withIndex("by_project_subcontractor", (q) =>
        q.eq("projectId", args.projectId).eq("subcontractorId", args.subcontractorId)
      )
      .first()

    if (!projectSub) return null

    const project = await ctx.db.get(args.projectId)
    return project
      ? {
          ...project,
          end_date: project.endDate
            ? new Date(project.endDate).toISOString().split("T")[0]
            : null,
        }
      : null
  },
})
