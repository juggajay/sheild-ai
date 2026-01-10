import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Get compliance history for a company
export const getHistory = query({
  args: {
    companyId: v.id("companies"),
    startDate: v.number(),
  },
  handler: async (ctx, args) => {
    const snapshots = await ctx.db
      .query("complianceSnapshots")
      .withIndex("by_company_date", (q) =>
        q.eq("companyId", args.companyId).gte("snapshotDate", args.startDate)
      )
      .collect()

    return snapshots.map((s) => ({
      date: new Date(s.snapshotDate).toISOString().split("T")[0],
      total: s.totalSubcontractors,
      compliant: s.compliant,
      nonCompliant: s.nonCompliant,
      pending: s.pending,
      exception: s.exception,
      complianceRate: s.complianceRate,
    }))
  },
})

// Check if today's snapshot exists
export const getTodaySnapshot = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()

    const snapshot = await ctx.db
      .query("complianceSnapshots")
      .withIndex("by_company_date", (q) =>
        q.eq("companyId", args.companyId).eq("snapshotDate", todayTimestamp)
      )
      .first()

    return snapshot
  },
})

// Calculate and create today's snapshot
export const createTodaySnapshot = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()

    // Check if today's snapshot already exists
    const existing = await ctx.db
      .query("complianceSnapshots")
      .withIndex("by_company_date", (q) =>
        q.eq("companyId", args.companyId).eq("snapshotDate", todayTimestamp)
      )
      .first()

    if (existing) {
      return existing._id
    }

    // Get all active projects for the company
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .collect()

    // Calculate compliance stats
    let total = 0
    let compliant = 0
    let nonCompliant = 0
    let pending = 0
    let exception = 0

    for (const project of projects) {
      const projectSubcontractors = await ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const ps of projectSubcontractors) {
        total++
        switch (ps.status) {
          case "compliant":
            compliant++
            break
          case "non_compliant":
            nonCompliant++
            break
          case "pending":
            pending++
            break
          case "exception":
            exception++
            break
        }
      }
    }

    const complianceRate =
      total > 0 ? Math.round(((compliant + exception) / total) * 100) : 0

    // Create the snapshot
    const snapshotId = await ctx.db.insert("complianceSnapshots", {
      companyId: args.companyId,
      snapshotDate: todayTimestamp,
      totalSubcontractors: total,
      compliant,
      nonCompliant,
      pending,
      exception,
      complianceRate,
    })

    return snapshotId
  },
})

// Generate historical snapshots (for demo/initial data)
export const generateHistoricalSnapshots = mutation({
  args: {
    companyId: v.id("companies"),
    days: v.number(),
  },
  handler: async (ctx, args) => {
    // Get current compliance stats
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .collect()

    let currentTotal = 0
    let currentCompliant = 0
    let currentException = 0

    for (const project of projects) {
      const projectSubcontractors = await ctx.db
        .query("projectSubcontractors")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()

      for (const ps of projectSubcontractors) {
        currentTotal++
        if (ps.status === "compliant") currentCompliant++
        if (ps.status === "exception") currentException++
      }
    }

    const total = currentTotal || 1
    const baseCompliance = currentCompliant + currentException

    // Generate snapshots for each day
    for (let i = args.days; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const dateTimestamp = date.getTime()

      // Check if snapshot exists
      const existing = await ctx.db
        .query("complianceSnapshots")
        .withIndex("by_company_date", (q) =>
          q.eq("companyId", args.companyId).eq("snapshotDate", dateTimestamp)
        )
        .first()

      if (!existing) {
        // Add variation to simulate historical changes
        const dayFactor = (args.days - i) / args.days
        const variation = Math.sin(i * 0.5) * 0.1

        let compliant = Math.round(
          baseCompliance * (0.7 + dayFactor * 0.3 + variation)
        )
        compliant = Math.max(0, Math.min(total, compliant))

        const remaining = total - compliant
        const nonCompliant = Math.round(remaining * (1 - dayFactor * 0.5))
        const pending = remaining - nonCompliant

        const complianceRate = Math.round(
          ((compliant + currentException) / total) * 100
        )

        await ctx.db.insert("complianceSnapshots", {
          companyId: args.companyId,
          snapshotDate: dateTimestamp,
          totalSubcontractors: total,
          compliant,
          nonCompliant: Math.max(0, nonCompliant),
          pending: Math.max(0, pending),
          exception: currentException,
          complianceRate: Math.min(100, Math.max(0, complianceRate)),
        })
      }
    }

    return { success: true }
  },
})
