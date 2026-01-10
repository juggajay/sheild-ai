import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Email template type validator
const emailTemplateType = v.union(
  v.literal("deficiency"),
  v.literal("follow_up_1"),
  v.literal("follow_up_2"),
  v.literal("follow_up_3"),
  v.literal("confirmation"),
  v.literal("expiration_reminder")
)

// Get email template by ID
export const getById = query({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get email templates by company
export const getByCompany = query({
  args: { companyId: v.optional(v.id("companies")) },
  handler: async (ctx, args) => {
    if (args.companyId) {
      return await ctx.db
        .query("emailTemplates")
        .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
        .collect()
    }
    // Get system defaults (companyId is null)
    return await ctx.db
      .query("emailTemplates")
      .filter((q) => q.eq(q.field("companyId"), undefined))
      .collect()
  },
})

// Get email template by company and type (with fallback to system default)
export const getByCompanyAndType = query({
  args: {
    companyId: v.id("companies"),
    type: emailTemplateType,
  },
  handler: async (ctx, args) => {
    // First try company-specific template
    const companyTemplate = await ctx.db
      .query("emailTemplates")
      .withIndex("by_type", (q) =>
        q.eq("companyId", args.companyId).eq("type", args.type)
      )
      .first()

    if (companyTemplate) {
      return companyTemplate
    }

    // Fall back to system default (companyId is undefined)
    const defaultTemplate = await ctx.db
      .query("emailTemplates")
      .filter((q) =>
        q.and(
          q.eq(q.field("companyId"), undefined),
          q.eq(q.field("type"), args.type),
          q.eq(q.field("isDefault"), true)
        )
      )
      .first()

    return defaultTemplate
  },
})

// Create email template
export const create = mutation({
  args: {
    companyId: v.optional(v.id("companies")),
    type: emailTemplateType,
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    const templateId = await ctx.db.insert("emailTemplates", {
      companyId: args.companyId,
      type: args.type,
      name: args.name,
      subject: args.subject,
      body: args.body,
      isDefault: args.isDefault,
      updatedAt: Date.now(),
    })
    return templateId
  },
})

// Update email template
export const update = mutation({
  args: {
    id: v.id("emailTemplates"),
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
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

// Delete email template
export const remove = mutation({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

// List templates for company with defaults initialization
export const listByCompanyWithDefaults = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // Get templates for this company and system defaults
    const companyTemplates = await ctx.db
      .query("emailTemplates")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const defaultTemplates = await ctx.db
      .query("emailTemplates")
      .filter((q) =>
        q.and(
          q.eq(q.field("companyId"), undefined),
          q.eq(q.field("isDefault"), true)
        )
      )
      .collect()

    // Merge: company templates take precedence
    const templatesByType = new Map<string, any>()
    for (const t of defaultTemplates) {
      templatesByType.set(t.type, t)
    }
    for (const t of companyTemplates) {
      templatesByType.set(t.type, t)
    }

    // Convert to array and format for API compatibility
    const templates = Array.from(templatesByType.values()).map((t) => ({
      id: t._id,
      company_id: t.companyId || null,
      type: t.type,
      name: t.name || null,
      subject: t.subject || null,
      body: t.body || null,
      is_default: t.isDefault ? 1 : 0,
      created_at: new Date(t._creationTime).toISOString(),
      updated_at: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
    }))

    // Sort by type
    templates.sort((a, b) => a.type.localeCompare(b.type))

    return templates
  },
})

// Initialize default templates for a company
export const initializeDefaults = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const DEFAULT_TEMPLATES = [
      {
        type: "deficiency" as const,
        name: "Deficiency Notice",
        subject:
          "Certificate of Currency Deficiency Notice - {{subcontractor_name}} / {{project_name}}",
        body: `Dear {{recipient_name}},

We have reviewed the Certificate of Currency submitted for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) and found the following compliance issues for the {{project_name}} project:

DEFICIENCIES FOUND:
{{deficiency_list}}

ACTION REQUIRED:
Please provide an updated Certificate of Currency that addresses the above deficiencies by {{due_date}}.

You can upload the updated certificate here: {{upload_link}}

If you have any questions or need clarification on the requirements, please don't hesitate to contact us.

Best regards,
RiskShield AI Compliance Team`,
      },
      {
        type: "confirmation" as const,
        name: "Compliance Confirmed",
        subject:
          "Insurance Compliance Confirmed - {{subcontractor_name}} / {{project_name}}",
        body: `Dear {{recipient_name}},

Great news! The Certificate of Currency submitted for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) has been verified and meets all requirements for the {{project_name}} project.

VERIFICATION RESULT: APPROVED

{{subcontractor_name}} is now approved to work on the {{project_name}} project. All insurance coverage requirements have been met.

Thank you for ensuring compliance with our insurance requirements. If you have any questions or need to update your certificate in the future, please don't hesitate to contact us.

Best regards,
RiskShield AI Compliance Team`,
      },
      {
        type: "expiration_reminder" as const,
        name: "Expiration Reminder",
        subject:
          "Certificate Expiring Soon - {{subcontractor_name}} / {{project_name}}",
        body: `Dear {{recipient_name}},

This is a reminder that the Certificate of Currency for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) will expire on {{expiry_date}}.

PROJECT: {{project_name}}
DAYS UNTIL EXPIRY: {{days_until_expiry}}

ACTION REQUIRED:
Please provide an updated Certificate of Currency before the expiration date to maintain compliance.

You can upload the updated certificate here: {{upload_link}}

If you have any questions, please contact us.

Best regards,
RiskShield AI Compliance Team`,
      },
      {
        type: "follow_up_1" as const,
        name: "First Follow-up",
        subject:
          "REMINDER: Certificate of Currency Required - {{subcontractor_name}} / {{project_name}}",
        body: `Dear {{recipient_name}},

This is a friendly reminder regarding the outstanding Certificate of Currency for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) for the {{project_name}} project.

OUTSTANDING ISSUES:
{{deficiency_list}}

Please provide the required documentation as soon as possible to maintain compliance.

Upload link: {{upload_link}}

Best regards,
RiskShield AI Compliance Team`,
      },
      {
        type: "follow_up_2" as const,
        name: "Second Follow-up",
        subject:
          "URGENT: Certificate of Currency Still Required - {{subcontractor_name}} / {{project_name}}",
        body: `Dear {{recipient_name}},

This is an urgent reminder that we still haven't received an updated Certificate of Currency for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) for the {{project_name}} project.

OUTSTANDING ISSUES:
{{deficiency_list}}

Please address this matter immediately to avoid any impact on site access.

Upload link: {{upload_link}}

Best regards,
RiskShield AI Compliance Team`,
      },
      {
        type: "follow_up_3" as const,
        name: "Final Notice",
        subject:
          "FINAL NOTICE: Certificate of Currency Required - {{subcontractor_name}} / {{project_name}}",
        body: `Dear {{recipient_name}},

FINAL NOTICE

Despite multiple reminders, we have not received an updated Certificate of Currency for {{subcontractor_name}} (ABN: {{subcontractor_abn}}) for the {{project_name}} project.

OUTSTANDING ISSUES:
{{deficiency_list}}

This matter requires immediate attention. Failure to provide compliant documentation may result in restricted site access.

Upload link: {{upload_link}}

Best regards,
RiskShield AI Compliance Team`,
      },
    ]

    // Check which templates already exist for this company
    const existingTemplates = await ctx.db
      .query("emailTemplates")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect()

    const existingTypes = new Set(existingTemplates.map((t) => t.type))

    // Create missing templates
    const created = []
    for (const template of DEFAULT_TEMPLATES) {
      if (!existingTypes.has(template.type)) {
        const id = await ctx.db.insert("emailTemplates", {
          companyId: args.companyId,
          type: template.type,
          name: template.name,
          subject: template.subject,
          body: template.body,
          isDefault: true,
          updatedAt: Date.now(),
        })
        created.push({ id, type: template.type })
      }
    }

    return created
  },
})

// Update template by ID with company verification
export const updateWithVerification = mutation({
  args: {
    id: v.id("emailTemplates"),
    companyId: v.id("companies"),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id)
    if (!template || template.companyId !== args.companyId) {
      throw new Error("Template not found or access denied")
    }

    const updates: any = { updatedAt: Date.now() }
    if (args.subject !== undefined) updates.subject = args.subject
    if (args.body !== undefined) updates.body = args.body

    await ctx.db.patch(args.id, updates)

    return await ctx.db.get(args.id)
  },
})
