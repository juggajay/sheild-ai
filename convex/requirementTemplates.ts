import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Standard templates available to all companies
const STANDARD_TEMPLATES = [
  {
    id: "template-commercial",
    name: "Commercial Construction",
    type: "commercial" as const,
    requirements: [
      {
        coverage_type: "public_liability",
        minimum_limit: 20000000,
        limit_type: "per_occurrence",
        maximum_excess: 10000,
        principal_indemnity_required: true,
        cross_liability_required: true,
      },
      {
        coverage_type: "professional_indemnity",
        minimum_limit: 5000000,
        limit_type: "per_occurrence",
        maximum_excess: 5000,
        principal_indemnity_required: false,
        cross_liability_required: false,
      },
      {
        coverage_type: "workers_comp",
        minimum_limit: null,
        limit_type: "per_occurrence",
        maximum_excess: null,
        principal_indemnity_required: false,
        cross_liability_required: false,
      },
    ],
  },
  {
    id: "template-residential",
    name: "Residential Construction",
    type: "residential" as const,
    requirements: [
      {
        coverage_type: "public_liability",
        minimum_limit: 10000000,
        limit_type: "per_occurrence",
        maximum_excess: 5000,
        principal_indemnity_required: true,
        cross_liability_required: false,
      },
      {
        coverage_type: "workers_comp",
        minimum_limit: null,
        limit_type: "per_occurrence",
        maximum_excess: null,
        principal_indemnity_required: false,
        cross_liability_required: false,
      },
    ],
  },
  {
    id: "template-civil",
    name: "Civil Infrastructure",
    type: "civil" as const,
    requirements: [
      {
        coverage_type: "public_liability",
        minimum_limit: 50000000,
        limit_type: "per_occurrence",
        maximum_excess: 20000,
        principal_indemnity_required: true,
        cross_liability_required: true,
      },
      {
        coverage_type: "professional_indemnity",
        minimum_limit: 10000000,
        limit_type: "per_occurrence",
        maximum_excess: 10000,
        principal_indemnity_required: false,
        cross_liability_required: false,
      },
      {
        coverage_type: "workers_comp",
        minimum_limit: null,
        limit_type: "per_occurrence",
        maximum_excess: null,
        principal_indemnity_required: false,
        cross_liability_required: false,
      },
      {
        coverage_type: "motor_vehicle",
        minimum_limit: 30000000,
        limit_type: "per_occurrence",
        maximum_excess: 5000,
        principal_indemnity_required: false,
        cross_liability_required: false,
      },
    ],
  },
  {
    id: "template-fitout",
    name: "Commercial Fitout",
    type: "fitout" as const,
    requirements: [
      {
        coverage_type: "public_liability",
        minimum_limit: 10000000,
        limit_type: "per_occurrence",
        maximum_excess: 5000,
        principal_indemnity_required: true,
        cross_liability_required: false,
      },
      {
        coverage_type: "workers_comp",
        minimum_limit: null,
        limit_type: "per_occurrence",
        maximum_excess: null,
        principal_indemnity_required: false,
        cross_liability_required: false,
      },
    ],
  },
]

// Get all templates for a company (standard + custom)
export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // Get custom templates for this company
    const customTemplates = await ctx.db
      .query("requirementTemplates")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    // Format custom templates
    const formattedCustomTemplates = customTemplates.map((t) => ({
      id: t._id,
      company_id: t.companyId,
      name: t.name,
      type: t.type,
      requirements: t.requirements,
      is_default: t.isDefault,
      is_standard: false,
      created_at: new Date(t._creationTime).toISOString(),
      updated_at: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
    }))

    // Combine standard templates with custom templates
    const allTemplates = [
      ...STANDARD_TEMPLATES.map((t) => ({
        id: t.id,
        company_id: null,
        name: t.name,
        type: t.type,
        requirements: t.requirements,
        is_default: false,
        is_standard: true,
        created_at: null,
        updated_at: null,
      })),
      ...formattedCustomTemplates,
    ]

    return { templates: allTemplates }
  },
})

// Get template by ID
export const getById = query({
  args: { id: v.id("requirementTemplates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Create custom template
export const create = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    requirements: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const templateId = await ctx.db.insert("requirementTemplates", {
      companyId: args.companyId,
      name: args.name.trim(),
      type: "custom",
      requirements: args.requirements,
      isDefault: false,
      updatedAt: Date.now(),
    })

    return templateId
  },
})

// Update template
export const update = mutation({
  args: {
    id: v.id("requirementTemplates"),
    name: v.optional(v.string()),
    requirements: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args

    const filteredUpdates: Record<string, unknown> = {}
    if (updates.name !== undefined) filteredUpdates.name = updates.name.trim()
    if (updates.requirements !== undefined) filteredUpdates.requirements = updates.requirements

    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    })

    return id
  },
})

// Delete template
export const remove = mutation({
  args: { id: v.id("requirementTemplates") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
