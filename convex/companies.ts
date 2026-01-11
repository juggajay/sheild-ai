import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Get company by ID
export const getById = query({
  args: { id: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get company by ABN
export const getByAbn = query({
  args: { abn: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_abn", (q) => q.eq("abn", args.abn))
      .first()
  },
})

// Get company by forwarding email
export const getByForwardingEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_forwarding_email", (q) => q.eq("forwardingEmail", args.email.toLowerCase()))
      .first()
  },
})

// Create company
export const create = mutation({
  args: {
    name: v.string(),
    abn: v.string(),
    acn: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    address: v.optional(v.string()),
    primaryContactName: v.optional(v.string()),
    primaryContactEmail: v.optional(v.string()),
    primaryContactPhone: v.optional(v.string()),
    forwardingEmail: v.optional(v.string()),
    settings: v.optional(v.any()),
    subscriptionTier: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if ABN already exists
    const existingByAbn = await ctx.db
      .query("companies")
      .withIndex("by_abn", (q) => q.eq("abn", args.abn))
      .first()

    if (existingByAbn) {
      throw new Error("Company with this ABN already exists")
    }

    // Check if forwarding email already exists
    if (args.forwardingEmail) {
      const existingByEmail = await ctx.db
        .query("companies")
        .withIndex("by_forwarding_email", (q) => q.eq("forwardingEmail", args.forwardingEmail!.toLowerCase()))
        .first()

      if (existingByEmail) {
        throw new Error("Forwarding email already in use")
      }
    }

    const companyId = await ctx.db.insert("companies", {
      name: args.name,
      abn: args.abn,
      acn: args.acn,
      logoUrl: args.logoUrl,
      address: args.address,
      primaryContactName: args.primaryContactName,
      primaryContactEmail: args.primaryContactEmail,
      primaryContactPhone: args.primaryContactPhone,
      forwardingEmail: args.forwardingEmail?.toLowerCase(),
      settings: args.settings || {},
      subscriptionTier: args.subscriptionTier || "trial",
      subscriptionStatus: args.subscriptionStatus || "active",
      updatedAt: Date.now(),
    })

    return companyId
  },
})

// Update company
export const update = mutation({
  args: {
    id: v.id("companies"),
    name: v.optional(v.string()),
    abn: v.optional(v.string()),
    acn: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    address: v.optional(v.string()),
    primaryContactName: v.optional(v.string()),
    primaryContactEmail: v.optional(v.string()),
    primaryContactPhone: v.optional(v.string()),
    forwardingEmail: v.optional(v.string()),
    settings: v.optional(v.any()),
    subscriptionTier: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args

    // If updating ABN, check it's not already in use
    if (updates.abn) {
      const existingByAbn = await ctx.db
        .query("companies")
        .withIndex("by_abn", (q) => q.eq("abn", updates.abn!))
        .first()

      if (existingByAbn && existingByAbn._id !== id) {
        throw new Error("Company with this ABN already exists")
      }
    }

    // If updating forwarding email, check it's not already in use
    if (updates.forwardingEmail) {
      const existingByEmail = await ctx.db
        .query("companies")
        .withIndex("by_forwarding_email", (q) => q.eq("forwardingEmail", updates.forwardingEmail!.toLowerCase()))
        .first()

      if (existingByEmail && existingByEmail._id !== id) {
        throw new Error("Forwarding email already in use")
      }
      updates.forwardingEmail = updates.forwardingEmail.toLowerCase()
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

// Delete company (with cascade)
export const remove = mutation({
  args: { id: v.id("companies") },
  handler: async (ctx, args) => {
    // Note: In a real app, you'd want to cascade delete or check for related data
    // For now, we just delete the company
    await ctx.db.delete(args.id)
  },
})

// Update company settings
export const updateSettings = mutation({
  args: {
    id: v.id("companies"),
    settings: v.any(),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.id)
    if (!company) throw new Error("Company not found")

    const mergedSettings = {
      ...(company.settings || {}),
      ...args.settings,
    }

    await ctx.db.patch(args.id, {
      settings: mergedSettings,
      updatedAt: Date.now(),
    })
  },
})

// Update subscription
export const updateSubscription = mutation({
  args: {
    id: v.id("companies"),
    subscriptionTier: v.string(),
    subscriptionStatus: v.string(),
    trialEndsAt: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.id)
    if (!company) throw new Error("Company not found")

    // Merge with existing settings to store Stripe-specific data
    const settings = {
      ...(company.settings || {}),
      trialEndsAt: args.trialEndsAt || (company.settings as Record<string, unknown>)?.trialEndsAt,
      stripeCustomerId: args.stripeCustomerId || (company.settings as Record<string, unknown>)?.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId || (company.settings as Record<string, unknown>)?.stripeSubscriptionId,
      subscriptionPeriodEnd: args.subscriptionPeriodEnd || (company.settings as Record<string, unknown>)?.subscriptionPeriodEnd,
    }

    await ctx.db.patch(args.id, {
      subscriptionTier: args.subscriptionTier,
      subscriptionStatus: args.subscriptionStatus,
      settings,
      updatedAt: Date.now(),
    })
  },
})

// Get subscription details with vendor count
export const getSubscriptionDetails = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId)
    if (!company) return null

    // Get vendor count
    const subcontractors = await ctx.db
      .query("subcontractors")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const vendorCount = subcontractors.length

    // Get billing events from audit logs
    const billingEvents = await ctx.db
      .query("auditLogs")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100)

    const billingAuditLogs = billingEvents
      .filter((log) => log.entityType === "subscription" || log.entityType === "billing")
      .slice(0, 10)

    const settings = company.settings as Record<string, unknown> || {}

    return {
      company: {
        ...company,
        stripe_customer_id: settings.stripeCustomerId,
        stripe_subscription_id: settings.stripeSubscriptionId,
        subscription_period_end: settings.subscriptionPeriodEnd,
        trial_ends_at: settings.trialEndsAt,
      },
      vendorCount,
      billingEvents: billingAuditLogs.map((event) => ({
        id: event._id,
        event_type: event.action,
        details: JSON.stringify(event.details || {}),
        created_at: new Date(event._creationTime).toISOString(),
      })),
    }
  },
})

// Update Stripe customer ID
export const updateStripeCustomerId = mutation({
  args: {
    id: v.id("companies"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.id)
    if (!company) throw new Error("Company not found")

    const settings = {
      ...(company.settings || {}),
      stripeCustomerId: args.stripeCustomerId,
    }

    await ctx.db.patch(args.id, {
      settings,
      updatedAt: Date.now(),
    })
  },
})

// Find company by Stripe customer ID
export const getByStripeCustomerId = query({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    // Since stripeCustomerId is stored in settings, we need to scan
    const companies = await ctx.db.query("companies").collect()

    for (const company of companies) {
      const settings = company.settings as Record<string, unknown> || {}
      if (settings.stripeCustomerId === args.stripeCustomerId) {
        return company
      }
    }

    return null
  },
})

// Find company by Stripe subscription ID
export const getByStripeSubscriptionId = query({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, args) => {
    // Since stripeSubscriptionId is stored in settings, we need to scan
    const companies = await ctx.db.query("companies").collect()

    for (const company of companies) {
      const settings = company.settings as Record<string, unknown> || {}
      if (settings.stripeSubscriptionId === args.stripeSubscriptionId) {
        return company
      }
    }

    return null
  },
})

// Update subscription from Stripe webhook
export const updateSubscriptionFromWebhook = mutation({
  args: {
    id: v.id("companies"),
    subscriptionTier: v.optional(v.string()),
    subscriptionStatus: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionPeriodEnd: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    clearSubscription: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.id)
    if (!company) throw new Error("Company not found")

    const currentSettings = company.settings as Record<string, unknown> || {}

    const newSettings = {
      ...currentSettings,
      stripeSubscriptionId: args.clearSubscription ? undefined : (args.stripeSubscriptionId || currentSettings.stripeSubscriptionId),
      subscriptionPeriodEnd: args.clearSubscription ? undefined : (args.subscriptionPeriodEnd || currentSettings.subscriptionPeriodEnd),
      trialEndsAt: args.trialEndsAt || currentSettings.trialEndsAt,
    }

    await ctx.db.patch(args.id, {
      subscriptionTier: args.subscriptionTier || company.subscriptionTier,
      subscriptionStatus: args.subscriptionStatus,
      settings: newSettings,
      updatedAt: Date.now(),
    })
  },
})

// Update subscription status only (for past_due, active transitions)
export const updateSubscriptionStatus = mutation({
  args: {
    id: v.id("companies"),
    subscriptionStatus: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      subscriptionStatus: args.subscriptionStatus,
      updatedAt: Date.now(),
    })
  },
})

// Vendor limit configuration by tier
const VENDOR_LIMITS: Record<string, number | null> = {
  trial: 50,
  velocity: 50,
  compliance: 200,
  business: 500,
  enterprise: null, // Unlimited
  subcontractor: 0,
}

// User limit configuration by tier
const USER_LIMITS: Record<string, number | null> = {
  trial: 3,
  velocity: 3,
  compliance: null, // Unlimited
  business: null,
  enterprise: null,
  subcontractor: 1,
}

// Project limit configuration by tier
const PROJECT_LIMITS: Record<string, number | null> = {
  trial: 5,
  velocity: 5,
  compliance: null, // Unlimited
  business: null,
  enterprise: null,
  subcontractor: 0,
}

// Get vendor limit info for a company
// Uses high water mark (vendorsAddedThisPeriod) to prevent gaming by delete/add cycles
export const getVendorLimitInfo = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId)
    if (!company) return null

    const tier = company.subscriptionTier || 'trial'
    const limit = VENDOR_LIMITS[tier] ?? null

    // Count current active vendors
    const subcontractors = await ctx.db
      .query("subcontractors")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()
    const activeCount = subcontractors.length

    // Use high water mark for billing purposes (prevents gaming)
    // High water mark = max vendors added this billing period
    const highWaterMark = company.vendorsAddedThisPeriod ?? activeCount
    const effectiveCount = Math.max(activeCount, highWaterMark)

    if (limit === null) {
      return {
        tier,
        limit: null,
        current: activeCount,
        highWaterMark,
        remaining: null,
        percentUsed: 0,
        isAtLimit: false,
        isNearLimit: false,
        canAddVendor: true,
      }
    }

    const remaining = Math.max(0, limit - effectiveCount)
    const percentUsed = limit > 0 ? Math.round((effectiveCount / limit) * 100) : 0

    return {
      tier,
      limit,
      current: activeCount,
      highWaterMark,
      remaining,
      percentUsed,
      isAtLimit: effectiveCount >= limit,
      isNearLimit: percentUsed >= 80,
      canAddVendor: effectiveCount < limit,
    }
  },
})

// Get all usage limits for a company
export const getUsageLimits = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId)
    if (!company) return null

    const tier = company.subscriptionTier || 'trial'

    // Get limits for this tier
    const vendorLimit = VENDOR_LIMITS[tier] ?? null
    const userLimit = USER_LIMITS[tier] ?? null
    const projectLimit = PROJECT_LIMITS[tier] ?? null

    // Count current usage
    const [subcontractors, users, projects] = await Promise.all([
      ctx.db
        .query("subcontractors")
        .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
        .collect(),
      ctx.db
        .query("users")
        .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
        .collect(),
    ])

    const vendorCount = subcontractors.length
    const userCount = users.length
    const projectCount = projects.length

    return {
      tier,
      subscriptionStatus: company.subscriptionStatus,
      vendors: {
        limit: vendorLimit,
        current: vendorCount,
        remaining: vendorLimit !== null ? Math.max(0, vendorLimit - vendorCount) : null,
        percentUsed: vendorLimit !== null && vendorLimit > 0 ? Math.round((vendorCount / vendorLimit) * 100) : 0,
        isAtLimit: vendorLimit !== null && vendorCount >= vendorLimit,
        isNearLimit: vendorLimit !== null && vendorLimit > 0 && (vendorCount / vendorLimit) >= 0.8,
      },
      users: {
        limit: userLimit,
        current: userCount,
        remaining: userLimit !== null ? Math.max(0, userLimit - userCount) : null,
        percentUsed: userLimit !== null && userLimit > 0 ? Math.round((userCount / userLimit) * 100) : 0,
        isAtLimit: userLimit !== null && userCount >= userLimit,
        isNearLimit: userLimit !== null && userLimit > 0 && (userCount / userLimit) >= 0.8,
      },
      projects: {
        limit: projectLimit,
        current: projectCount,
        remaining: projectLimit !== null ? Math.max(0, projectLimit - projectCount) : null,
        percentUsed: projectLimit !== null && projectLimit > 0 ? Math.round((projectCount / projectLimit) * 100) : 0,
        isAtLimit: projectLimit !== null && projectCount >= projectLimit,
        isNearLimit: projectLimit !== null && projectLimit > 0 && (projectCount / projectLimit) >= 0.8,
      },
    }
  },
})

// Check if a company can add a vendor (pre-check before creation)
export const canAddVendor = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId)
    if (!company) {
      return { allowed: false, reason: "Company not found" }
    }

    // Check subscription status
    if (company.subscriptionStatus === 'cancelled') {
      return { allowed: false, reason: "Subscription is cancelled. Please reactivate to add vendors." }
    }

    if (company.subscriptionStatus === 'past_due') {
      return { allowed: false, reason: "Payment is past due. Please update your payment method." }
    }

    const tier = company.subscriptionTier || 'trial'
    const limit = VENDOR_LIMITS[tier] ?? null

    // Unlimited tier
    if (limit === null) {
      return { allowed: true }
    }

    // Count current vendors
    const subcontractors = await ctx.db
      .query("subcontractors")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()
    const activeCount = subcontractors.length

    // Use high water mark to prevent gaming by delete/add cycles
    const highWaterMark = company.vendorsAddedThisPeriod ?? activeCount
    const effectiveCount = Math.max(activeCount, highWaterMark)

    if (effectiveCount >= limit) {
      return {
        allowed: false,
        reason: `You've reached your vendor limit of ${limit}. Upgrade your plan to add more vendors.`,
        currentCount: activeCount,
        highWaterMark,
        limit,
        suggestedUpgrade: getSuggestedUpgradeTier(tier),
      }
    }

    return { allowed: true, currentCount: activeCount, highWaterMark, limit, remaining: limit - effectiveCount }
  },
})

// Helper function to get suggested upgrade tier
function getSuggestedUpgradeTier(currentTier: string): string | null {
  const upgradeMap: Record<string, string | null> = {
    trial: 'velocity',
    velocity: 'compliance',
    compliance: 'business',
    business: 'enterprise',
    enterprise: null,
  }
  return upgradeMap[currentTier] ?? null
}

// Increment the vendor high water mark when a new vendor is added
// This prevents gaming by delete/add cycles within a billing period
export const incrementVendorHighWaterMark = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId)
    if (!company) return

    // Count current vendors to ensure high water mark is at least current count
    const subcontractors = await ctx.db
      .query("subcontractors")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const currentCount = subcontractors.length
    const currentHighWater = company.vendorsAddedThisPeriod ?? 0

    // Only increment if adding would increase the high water mark
    // This handles the case where we're re-adding a deleted vendor
    const newHighWater = Math.max(currentHighWater, currentCount)

    await ctx.db.patch(args.companyId, {
      vendorsAddedThisPeriod: newHighWater,
      updatedAt: Date.now(),
    })

    return { previousHighWater: currentHighWater, newHighWater }
  },
})

// Reset the billing period high water mark
// Called by Stripe webhook on subscription renewal
export const resetBillingPeriodVendorCount = mutation({
  args: {
    companyId: v.id("companies"),
    billingPeriodStart: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId)
    if (!company) return

    // Count current active vendors - this becomes the new baseline
    const subcontractors = await ctx.db
      .query("subcontractors")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const activeCount = subcontractors.length

    await ctx.db.patch(args.companyId, {
      vendorsAddedThisPeriod: activeCount, // Reset to current count
      billingPeriodStart: args.billingPeriodStart ?? Date.now(),
      updatedAt: Date.now(),
    })

    return { resetTo: activeCount, billingPeriodStart: args.billingPeriodStart ?? Date.now() }
  },
})

// Reset billing period vendor count by Stripe subscription ID
// Called by Stripe webhook on invoice.paid for subscription renewals
export const resetBillingPeriodBySubscriptionId = mutation({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find company by subscription ID
    const companies = await ctx.db.query("companies").collect()
    let company = null

    for (const c of companies) {
      const settings = c.settings as Record<string, unknown> || {}
      if (settings.stripeSubscriptionId === args.stripeSubscriptionId) {
        company = c
        break
      }
    }

    if (!company) {
      console.warn(`No company found for subscription: ${args.stripeSubscriptionId}`)
      return { success: false, reason: "Company not found" }
    }

    // Count current active vendors - this becomes the new baseline
    const subcontractors = await ctx.db
      .query("subcontractors")
      .withIndex("by_company", (q) => q.eq("companyId", company._id))
      .collect()

    const activeCount = subcontractors.length
    const billingPeriodStart = Date.now()

    await ctx.db.patch(company._id, {
      vendorsAddedThisPeriod: activeCount, // Reset to current count
      billingPeriodStart,
      updatedAt: Date.now(),
    })

    console.log(`Reset vendor count for ${company.name}: ${activeCount}`)
    return { success: true, companyId: company._id, resetTo: activeCount, billingPeriodStart }
  },
})
