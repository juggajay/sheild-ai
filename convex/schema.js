import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
// Role types
var userRole = v.union(v.literal("admin"), v.literal("risk_manager"), v.literal("project_manager"), v.literal("project_administrator"), v.literal("read_only"), v.literal("subcontractor"), v.literal("broker"));
// Australian state types
var australianState = v.union(v.literal("NSW"), v.literal("VIC"), v.literal("QLD"), v.literal("WA"), v.literal("SA"), v.literal("TAS"), v.literal("NT"), v.literal("ACT"));
// Project status types
var projectStatus = v.union(v.literal("active"), v.literal("completed"), v.literal("on_hold"));
// Compliance status types
var complianceStatus = v.union(v.literal("pending"), v.literal("compliant"), v.literal("non_compliant"), v.literal("exception"));
// Coverage type
var coverageType = v.union(v.literal("public_liability"), v.literal("products_liability"), v.literal("workers_comp"), v.literal("professional_indemnity"), v.literal("motor_vehicle"), v.literal("contract_works"));
// Document source
var documentSource = v.union(v.literal("email"), v.literal("upload"), v.literal("portal"), v.literal("api"));
// Processing status
var processingStatus = v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed"));
// Verification status
var verificationStatus = v.union(v.literal("pass"), v.literal("fail"), v.literal("review"));
// Communication type
var communicationType = v.union(v.literal("deficiency"), v.literal("follow_up"), v.literal("confirmation"), v.literal("expiration_reminder"), v.literal("critical_alert"));
// Communication channel
var communicationChannel = v.union(v.literal("email"), v.literal("sms"));
// Communication status
var communicationStatus = v.union(v.literal("pending"), v.literal("sent"), v.literal("delivered"), v.literal("opened"), v.literal("failed"));
// Exception risk level
var riskLevel = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));
// Exception expiration type
var expirationType = v.union(v.literal("until_resolved"), v.literal("fixed_duration"), v.literal("specific_date"), v.literal("permanent"));
// Exception status
var exceptionStatus = v.union(v.literal("pending_approval"), v.literal("active"), v.literal("expired"), v.literal("resolved"), v.literal("closed"));
// Notification type
var notificationType = v.union(v.literal("coc_received"), v.literal("coc_verified"), v.literal("coc_failed"), v.literal("exception_created"), v.literal("exception_approved"), v.literal("exception_expired"), v.literal("expiration_warning"), v.literal("communication_sent"), v.literal("stop_work_risk"), v.literal("system"));
// OAuth provider
var oauthProvider = v.union(v.literal("microsoft"), v.literal("google"), v.literal("procore"));
// Email template type
var emailTemplateType = v.union(v.literal("deficiency"), v.literal("follow_up_1"), v.literal("follow_up_2"), v.literal("follow_up_3"), v.literal("confirmation"), v.literal("expiration_reminder"));
// Requirement template type
var requirementTemplateType = v.union(v.literal("commercial"), v.literal("residential"), v.literal("civil"), v.literal("fitout"), v.literal("custom"));
// Procore entity types
var procoreEntityType = v.union(v.literal("project"), v.literal("vendor"));
var shieldEntityType = v.union(v.literal("project"), v.literal("subcontractor"));
var syncDirection = v.union(v.literal("procore_to_shield"), v.literal("shield_to_procore"), v.literal("bidirectional"));
var syncStatus = v.union(v.literal("active"), v.literal("paused"), v.literal("error"));
var procoreSyncType = v.union(v.literal("projects"), v.literal("vendors"), v.literal("compliance_push"));
var procoreSyncStatus = v.union(v.literal("started"), v.literal("completed"), v.literal("failed"));
export default defineSchema({
    // Companies - Multi-tenant root entity
    companies: defineTable({
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
        subscriptionTier: v.string(),
        subscriptionStatus: v.string(),
        updatedAt: v.number(),
    })
        .index("by_abn", ["abn"])
        .index("by_forwarding_email", ["forwardingEmail"]),
    // Users - User accounts with roles
    users: defineTable({
        companyId: v.optional(v.id("companies")),
        email: v.string(),
        passwordHash: v.string(),
        name: v.string(),
        phone: v.optional(v.string()),
        role: userRole,
        avatarUrl: v.optional(v.string()),
        notificationPreferences: v.optional(v.any()),
        invitationStatus: v.optional(v.string()),
        invitationToken: v.optional(v.string()),
        invitationExpiresAt: v.optional(v.number()),
        lastLoginAt: v.optional(v.number()),
        updatedAt: v.number(),
    })
        .index("by_email", ["email"])
        .index("by_company", ["companyId"])
        .index("by_invitation_token", ["invitationToken"]),
    // Sessions - JWT session storage
    sessions: defineTable({
        userId: v.id("users"),
        token: v.string(),
        expiresAt: v.number(),
    })
        .index("by_token", ["token"])
        .index("by_user", ["userId"])
        .index("by_expires", ["expiresAt"]),
    // Projects - Construction projects
    projects: defineTable({
        companyId: v.id("companies"),
        name: v.string(),
        address: v.optional(v.string()),
        state: v.optional(australianState),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
        estimatedValue: v.optional(v.number()),
        projectManagerId: v.optional(v.id("users")),
        forwardingEmail: v.optional(v.string()),
        status: projectStatus,
        updatedAt: v.number(),
    })
        .index("by_company", ["companyId"])
        .index("by_status", ["companyId", "status"])
        .index("by_manager", ["projectManagerId"])
        .index("by_forwarding_email", ["forwardingEmail"]),
    // Subcontractors - Contractor database
    subcontractors: defineTable({
        companyId: v.id("companies"),
        name: v.string(),
        abn: v.string(),
        acn: v.optional(v.string()),
        tradingName: v.optional(v.string()),
        address: v.optional(v.string()),
        trade: v.optional(v.string()),
        contactName: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        contactPhone: v.optional(v.string()),
        brokerName: v.optional(v.string()),
        brokerEmail: v.optional(v.string()),
        brokerPhone: v.optional(v.string()),
        workersCompState: v.optional(v.string()),
        portalAccess: v.boolean(),
        portalUserId: v.optional(v.id("users")),
        updatedAt: v.number(),
    })
        .index("by_company", ["companyId"])
        .index("by_abn", ["companyId", "abn"])
        .index("by_name", ["companyId", "name"])
        .searchIndex("search_name", {
        searchField: "name",
        filterFields: ["companyId"],
    }),
    // Project-Subcontractor junction with compliance status
    projectSubcontractors: defineTable({
        projectId: v.id("projects"),
        subcontractorId: v.id("subcontractors"),
        status: complianceStatus,
        onSiteDate: v.optional(v.number()),
        updatedAt: v.number(),
    })
        .index("by_project", ["projectId"])
        .index("by_subcontractor", ["subcontractorId"])
        .index("by_project_subcontractor", ["projectId", "subcontractorId"])
        .index("by_status", ["projectId", "status"]),
    // Insurance requirements - Project-specific insurance rules
    insuranceRequirements: defineTable({
        projectId: v.id("projects"),
        coverageType: coverageType,
        minimumLimit: v.optional(v.number()),
        limitType: v.optional(v.string()),
        maximumExcess: v.optional(v.number()),
        principalIndemnityRequired: v.boolean(),
        crossLiabilityRequired: v.boolean(),
        waiverOfSubrogationRequired: v.boolean(),
        principalNamingRequired: v.optional(v.string()),
        otherRequirements: v.optional(v.string()),
        updatedAt: v.number(),
    })
        .index("by_project", ["projectId"])
        .index("by_coverage_type", ["projectId", "coverageType"]),
    // COC Documents - Certificate of Currency files
    cocDocuments: defineTable({
        subcontractorId: v.id("subcontractors"),
        projectId: v.id("projects"),
        fileUrl: v.string(),
        fileName: v.optional(v.string()),
        fileSize: v.optional(v.number()),
        storageId: v.optional(v.id("_storage")),
        source: documentSource,
        sourceEmail: v.optional(v.string()),
        receivedAt: v.optional(v.number()),
        processedAt: v.optional(v.number()),
        processingStatus: processingStatus,
        updatedAt: v.number(),
    })
        .index("by_subcontractor", ["subcontractorId"])
        .index("by_project", ["projectId"])
        .index("by_processing_status", ["processingStatus"])
        .index("by_subcontractor_project", ["subcontractorId", "projectId"]),
    // Verifications - AI verification results
    verifications: defineTable({
        cocDocumentId: v.id("cocDocuments"),
        projectId: v.id("projects"),
        status: verificationStatus,
        confidenceScore: v.optional(v.number()),
        extractedData: v.optional(v.any()),
        checks: v.optional(v.array(v.any())),
        deficiencies: v.optional(v.array(v.any())),
        verifiedByUserId: v.optional(v.id("users")),
        verifiedAt: v.optional(v.number()),
        updatedAt: v.number(),
    })
        .index("by_document", ["cocDocumentId"])
        .index("by_project", ["projectId"])
        .index("by_status", ["projectId", "status"]),
    // Communications - Email/SMS notifications
    communications: defineTable({
        subcontractorId: v.id("subcontractors"),
        projectId: v.id("projects"),
        verificationId: v.optional(v.id("verifications")),
        type: communicationType,
        channel: communicationChannel,
        recipientEmail: v.optional(v.string()),
        ccEmails: v.optional(v.string()),
        subject: v.optional(v.string()),
        body: v.optional(v.string()),
        status: communicationStatus,
        sentAt: v.optional(v.number()),
        deliveredAt: v.optional(v.number()),
        openedAt: v.optional(v.number()),
        updatedAt: v.number(),
    })
        .index("by_subcontractor", ["subcontractorId"])
        .index("by_project", ["projectId"])
        .index("by_status", ["status"]),
    // Exceptions - Compliance waivers
    exceptions: defineTable({
        projectSubcontractorId: v.id("projectSubcontractors"),
        verificationId: v.optional(v.id("verifications")),
        issueSummary: v.string(),
        reason: v.string(),
        riskLevel: riskLevel,
        createdByUserId: v.id("users"),
        approvedByUserId: v.optional(v.id("users")),
        approvedAt: v.optional(v.number()),
        expiresAt: v.optional(v.number()),
        expirationType: expirationType,
        status: exceptionStatus,
        resolvedAt: v.optional(v.number()),
        resolutionType: v.optional(v.string()),
        resolutionNotes: v.optional(v.string()),
        supportingDocumentUrl: v.optional(v.string()),
        updatedAt: v.number(),
    })
        .index("by_project_subcontractor", ["projectSubcontractorId"])
        .index("by_status", ["status"])
        .index("by_expires", ["expiresAt"]),
    // Notifications - In-app notifications
    notifications: defineTable({
        userId: v.id("users"),
        companyId: v.id("companies"),
        type: notificationType,
        title: v.string(),
        message: v.string(),
        link: v.optional(v.string()),
        entityType: v.optional(v.string()),
        entityId: v.optional(v.string()),
        read: v.boolean(),
    })
        .index("by_user", ["userId"])
        .index("by_user_read", ["userId", "read"])
        .index("by_company", ["companyId"]),
    // Audit logs - Full audit trail
    auditLogs: defineTable({
        companyId: v.optional(v.id("companies")),
        userId: v.optional(v.id("users")),
        entityType: v.string(),
        entityId: v.string(),
        action: v.string(),
        details: v.optional(v.any()),
        ipAddress: v.optional(v.string()),
        userAgent: v.optional(v.string()),
    })
        .index("by_company", ["companyId"])
        .index("by_entity", ["entityType", "entityId"])
        .index("by_user", ["userId"]),
    // Email templates - Customizable templates
    emailTemplates: defineTable({
        companyId: v.optional(v.id("companies")),
        type: emailTemplateType,
        name: v.optional(v.string()),
        subject: v.optional(v.string()),
        body: v.optional(v.string()),
        isDefault: v.boolean(),
        updatedAt: v.number(),
    })
        .index("by_company", ["companyId"])
        .index("by_type", ["companyId", "type"]),
    // Requirement templates - Reusable insurance requirements
    requirementTemplates: defineTable({
        companyId: v.optional(v.id("companies")),
        name: v.string(),
        type: requirementTemplateType,
        requirements: v.optional(v.array(v.any())),
        isDefault: v.boolean(),
        updatedAt: v.number(),
    })
        .index("by_company", ["companyId"])
        .index("by_type", ["companyId", "type"]),
    // Compliance snapshots - Historical compliance data
    complianceSnapshots: defineTable({
        companyId: v.id("companies"),
        snapshotDate: v.number(),
        totalSubcontractors: v.number(),
        compliant: v.number(),
        nonCompliant: v.number(),
        pending: v.number(),
        exception: v.number(),
        complianceRate: v.number(),
    })
        .index("by_company", ["companyId"])
        .index("by_company_date", ["companyId", "snapshotDate"]),
    // Password reset tokens
    passwordResetTokens: defineTable({
        userId: v.id("users"),
        token: v.string(),
        expiresAt: v.number(),
        used: v.boolean(),
    })
        .index("by_token", ["token"])
        .index("by_user", ["userId"]),
    // Magic link tokens - Portal auth
    magicLinkTokens: defineTable({
        email: v.string(),
        token: v.string(),
        expiresAt: v.number(),
        used: v.boolean(),
    })
        .index("by_token", ["token"])
        .index("by_email", ["email"]),
    // OAuth states - OAuth CSRF protection
    oauthStates: defineTable({
        userId: v.id("users"),
        companyId: v.id("companies"),
        provider: oauthProvider,
        state: v.string(),
        expiresAt: v.number(),
    })
        .index("by_state", ["state"])
        .index("by_user", ["userId"]),
    // OAuth connections - OAuth token storage
    oauthConnections: defineTable({
        companyId: v.id("companies"),
        provider: oauthProvider,
        email: v.optional(v.string()),
        accessToken: v.string(),
        refreshToken: v.optional(v.string()),
        tokenExpiresAt: v.optional(v.number()),
        lastSyncAt: v.optional(v.number()),
        procoreCompanyId: v.optional(v.number()),
        procoreCompanyName: v.optional(v.string()),
        pendingCompanySelection: v.optional(v.boolean()),
        updatedAt: v.number(),
    })
        .index("by_company", ["companyId"])
        .index("by_company_provider", ["companyId", "provider"]),
    // Procore mappings - Entity sync tracking
    procoreMappings: defineTable({
        companyId: v.id("companies"),
        procoreCompanyId: v.number(),
        procoreEntityType: procoreEntityType,
        procoreEntityId: v.number(),
        shieldEntityType: shieldEntityType,
        shieldEntityId: v.string(),
        lastSyncedAt: v.number(),
        syncDirection: syncDirection,
        syncStatus: syncStatus,
        syncError: v.optional(v.string()),
        updatedAt: v.number(),
    })
        .index("by_company", ["companyId"])
        .index("by_procore", ["procoreCompanyId", "procoreEntityType", "procoreEntityId"])
        .index("by_shield", ["shieldEntityType", "shieldEntityId"]),
    // Procore sync log - Audit trail for syncs
    procoreSyncLog: defineTable({
        companyId: v.id("companies"),
        procoreCompanyId: v.number(),
        syncType: procoreSyncType,
        status: procoreSyncStatus,
        totalItems: v.optional(v.number()),
        createdCount: v.optional(v.number()),
        updatedCount: v.optional(v.number()),
        skippedCount: v.optional(v.number()),
        errorCount: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
        startedAt: v.number(),
        completedAt: v.optional(v.number()),
        durationMs: v.optional(v.number()),
    })
        .index("by_company", ["companyId", "startedAt"]),
});
