"use node"

import { v } from "convex/values"
import { internalAction } from "./_generated/server"
import { internal, api } from "./_generated/api"
import { Id } from "./_generated/dataModel"

// Environment check for test mode
const isTestMode = () => process.env.CRON_TEST_MODE === "true"

// Helper to get start of today in UTC
function getStartOfTodayUTC(): number {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime()
}

// Helper to format date for display
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// ============================================================================
// JOB A: Daily Expiration Check
// Schedule: 6:00 AM AEDT (19:00 UTC previous day)
// Purpose: Find certificates expiring in next 30/14/7/0 days and queue alerts
// ============================================================================
export const runExpirationCheck = internalAction({
  handler: async (ctx) => {
    console.log("[CRON] Starting daily expiration check...")

    // Start job logging
    const logId = await ctx.runMutation(internal.cronJobLogs.startJob, {
      jobName: "daily-expiration-check",
    })

    const errors: string[] = []
    let processed = 0

    try {
      // Get all companies with active subscriptions
      const companies = await ctx.runQuery(internal.companies.getActiveCompanies, {})

      for (const company of companies) {
        try {
          // Get expirations for this company
          const now = Date.now()
          const expirationData = await ctx.runQuery(api.verifications.getExpirations, {
            companyId: company._id,
            startDate: now - 7 * 24 * 60 * 60 * 1000, // Include already expired (past 7 days)
            endDate: now + 30 * 24 * 60 * 60 * 1000, // Next 30 days
          })

          // Get admin users for notifications
          const admins = await ctx.runQuery(internal.users.getAdminsByCompany, {
            companyId: company._id,
          })

          for (const expiration of expirationData.expirations) {
            try {
              const days = expiration.days_until_expiry

              // Determine alert level
              let alertLevel: "upcoming" | "soon" | "urgent" | "expired" | null = null
              if (days <= 0) alertLevel = "expired"
              else if (days <= 7) alertLevel = "urgent"
              else if (days <= 14) alertLevel = "soon"
              else if (days <= 30) alertLevel = "upcoming"

              if (!alertLevel) continue

              // Check if we already sent this type of alert today (idempotency)
              const alreadySent = await ctx.runQuery(
                internal.communications.checkIfSentToday,
                {
                  subcontractorId: expiration.subcontractor_id as Id<"subcontractors">,
                  type: "expiration_reminder",
                }
              )
              if (alreadySent) continue

              // Get subcontractor details for email
              const subcontractor = await ctx.runQuery(internal.subcontractors.getByIdInternal, {
                id: expiration.subcontractor_id as Id<"subcontractors">,
              })
              if (!subcontractor) continue

              // Send to subcontractor contact first (they contact their own broker)
              const recipientEmail = subcontractor.contactEmail || subcontractor.brokerEmail
              if (!recipientEmail) {
                errors.push(`No email for subcontractor ${expiration.subcontractor_name}`)
                continue
              }

              // Send expiration reminder email
              if (isTestMode()) {
                console.log(`[TEST MODE] Would send expiration ${alertLevel} email to ${recipientEmail} for ${expiration.subcontractor_name}`)
              } else {
                const { sendExpirationReminderEmail } = await import("../lib/resend")
                await sendExpirationReminderEmail({
                  recipientEmail,
                  recipientName: subcontractor.contactName || subcontractor.brokerName || "Subcontractor",
                  subcontractorName: expiration.subcontractor_name,
                  subcontractorAbn: subcontractor.abn,
                  projectName: expiration.project_name,
                  expiryDate: expiration.expiry_date,
                  daysUntilExpiry: days,
                  uploadLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://riskshield.ai"}/portal`,
                })
              }

              // Record communication
              await ctx.runMutation(internal.communications.createInternal, {
                subcontractorId: expiration.subcontractor_id as Id<"subcontractors">,
                projectId: expiration.project_id as Id<"projects">,
                type: "expiration_reminder",
                channel: "email",
                recipientEmail,
                subject: `Certificate Expiring ${alertLevel === "expired" ? "EXPIRED" : `in ${days} days`}`,
                status: "sent",
                sentAt: Date.now(),
              })

              // Create notification for admins
              for (const admin of admins) {
                await ctx.runMutation(internal.notifications.createInternal, {
                  userId: admin._id,
                  companyId: company._id,
                  type: "expiration_warning",
                  title: `Certificate ${alertLevel === "expired" ? "Expired" : "Expiring Soon"}`,
                  message: `${expiration.subcontractor_name}'s certificate for ${expiration.project_name} ${alertLevel === "expired" ? "has expired" : `expires in ${days} days`}`,
                  link: `/dashboard/verifications/${expiration.id}`,
                  entityType: "verification",
                  entityId: expiration.id,
                })
              }

              processed++
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              errors.push(`Expiration ${expiration.id}: ${msg}`)
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          errors.push(`Company ${company.name}: ${msg}`)
        }
      }

      // Complete job logging
      await ctx.runMutation(internal.cronJobLogs.completeJob, {
        logId,
        status: errors.length === 0 ? "success" : errors.length < processed ? "partial" : "failed",
        recordsProcessed: processed,
        errors: errors.length > 0 ? errors : undefined,
        metadata: { alertsSent: processed },
      })

      console.log(`[CRON] Expiration check complete. Processed: ${processed}, Errors: ${errors.length}`)
      return { processed, errors }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await ctx.runMutation(internal.cronJobLogs.completeJob, {
        logId,
        status: "failed",
        recordsProcessed: processed,
        errors: [msg, ...errors],
      })
      throw e
    }
  },
})

// ============================================================================
// JOB B: Morning Brief Email
// Schedule: 7:00 AM AEDT (20:00 UTC previous day)
// Purpose: Send daily compliance summary to admins/risk managers
// ============================================================================
export const runMorningBrief = internalAction({
  handler: async (ctx) => {
    console.log("[CRON] Starting morning brief email...")

    const logId = await ctx.runMutation(internal.cronJobLogs.startJob, {
      jobName: "morning-brief-email",
    })

    const errors: string[] = []
    let processed = 0

    try {
      // Get all companies with active subscriptions
      const companies = await ctx.runQuery(internal.companies.getActiveCompanies, {})

      for (const company of companies) {
        try {
          // Get morning brief data
          const briefData = await ctx.runQuery(api.dashboard.getMorningBrief, {
            companyId: company._id,
          })

          // Get admin and risk manager users
          const admins = await ctx.runQuery(internal.users.getAdminsByCompany, {
            companyId: company._id,
          })

          if (admins.length === 0) continue

          // Format email content
          const emailBody = formatMorningBriefEmail(company.name, briefData)

          for (const admin of admins) {
            if (!admin.email) continue

            if (isTestMode()) {
              console.log(`[TEST MODE] Would send morning brief to ${admin.email} for ${company.name}`)
            } else {
              const { sendEmail } = await import("../lib/resend")
              await sendEmail({
                to: admin.email,
                subject: `[RiskShield] Morning Compliance Brief - ${new Date().toLocaleDateString("en-AU")}`,
                html: emailBody,
              })
            }

            processed++
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          errors.push(`Company ${company.name}: ${msg}`)
        }
      }

      await ctx.runMutation(internal.cronJobLogs.completeJob, {
        logId,
        status: errors.length === 0 ? "success" : errors.length < processed ? "partial" : "failed",
        recordsProcessed: processed,
        errors: errors.length > 0 ? errors : undefined,
      })

      console.log(`[CRON] Morning brief complete. Emails sent: ${processed}`)
      return { processed, errors }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await ctx.runMutation(internal.cronJobLogs.completeJob, {
        logId,
        status: "failed",
        recordsProcessed: processed,
        errors: [msg, ...errors],
      })
      throw e
    }
  },
})

// Helper to format morning brief email
function formatMorningBriefEmail(companyName: string, data: any): string {
  const stats = data.stats || {}
  const stopWorkRisks = data.stopWorkRisks || []
  const newCocs = data.newCocs || []
  const pendingResponses = data.pendingResponses || []

  return `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a365d;">Good Morning, ${companyName}</h1>
        <p style="color: #4a5568;">Here's your daily compliance summary for ${new Date().toLocaleDateString("en-AU")}</p>

        <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #2d3748;">Compliance Overview</h2>
          <p style="font-size: 24px; margin: 10px 0;">
            <strong style="color: ${(stats.complianceRate || 0) >= 80 ? "#38a169" : "#e53e3e"}">
              ${stats.complianceRate?.toFixed(1) || 0}%
            </strong> Compliance Rate
          </p>
          <table style="width: 100%;">
            <tr>
              <td>Active Projects: <strong>${stats.activeProjects || 0}</strong></td>
              <td>Pending Reviews: <strong>${stats.pendingReviews || 0}</strong></td>
            </tr>
            <tr>
              <td>Compliant: <strong>${stats.compliant || 0}</strong></td>
              <td>Non-Compliant: <strong>${stats.non_compliant || 0}</strong></td>
            </tr>
          </table>
        </div>

        ${stopWorkRisks.length > 0 ? `
        <div style="background: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e53e3e;">
          <h2 style="margin-top: 0; color: #c53030;">⚠️ Stop Work Risks (${stopWorkRisks.length})</h2>
          <ul>
            ${stopWorkRisks.slice(0, 5).map((r: any) => `
              <li><strong>${r.subcontractor_name}</strong> - ${r.project_name}</li>
            `).join("")}
          </ul>
        </div>
        ` : ""}

        ${newCocs.length > 0 ? `
        <div style="background: #f0fff4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #276749;">New COCs Received (${newCocs.length})</h2>
          <p>Auto-approved: ${data.cocStats?.autoApproved || 0} | Needs Review: ${data.cocStats?.needsReview || 0}</p>
        </div>
        ` : ""}

        ${pendingResponses.length > 0 ? `
        <div style="background: #fffaf0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #c05621;">Pending Responses (${pendingResponses.length})</h2>
          <ul>
            ${pendingResponses.slice(0, 5).map((p: any) => `
              <li>${p.subcontractor_name} - waiting ${p.days_waiting} days</li>
            `).join("")}
          </ul>
        </div>
        ` : ""}

        <p style="color: #718096; font-size: 12px; margin-top: 30px;">
          This is an automated email from RiskShield AI.
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://riskshield.ai"}/dashboard">View Dashboard</a>
        </p>
      </body>
    </html>
  `
}

// ============================================================================
// JOB C: Automated Follow-up Sequences
// Schedule: 8:00 AM AEDT (21:00 UTC previous day)
// Purpose: Send follow-up emails to subcontractors with certificate issues
// ============================================================================
export const runFollowUpSequence = internalAction({
  handler: async (ctx) => {
    console.log("[CRON] Starting automated follow-ups...")

    const logId = await ctx.runMutation(internal.cronJobLogs.startJob, {
      jobName: "automated-follow-ups",
    })

    const errors: string[] = []
    let processed = 0
    let escalated = 0

    try {
      // Get all companies with active subscriptions
      const companies = await ctx.runQuery(internal.companies.getActiveCompanies, {})

      for (const company of companies) {
        try {
          // Get pending follow-ups
          const pendingFollowups = await ctx.runQuery(api.dashboard.getPendingFollowups, {
            companyId: company._id,
            minDaysWaiting: 3, // Start follow-ups after 3 days
          })

          // Get project admins for CC on emails
          const admins = await ctx.runQuery(internal.users.getAdminsByCompany, {
            companyId: company._id,
          })
          const adminEmails = admins
            .filter((a) => a.email)
            .map((a) => a.email as string)

          for (const item of pendingFollowups) {
            try {
              const daysWaiting = item.days_since_last

              // Determine follow-up stage
              let followUpNumber: number
              let shouldEscalate = false

              if (daysWaiting >= 10) {
                shouldEscalate = true
                followUpNumber = 3
              } else if (daysWaiting >= 7) {
                followUpNumber = 3
              } else if (daysWaiting >= 5) {
                followUpNumber = 2
              } else {
                followUpNumber = 1
              }

              // Get subcontractor for email - prioritize subcontractor contact, not broker
              const subcontractor = await ctx.runQuery(internal.subcontractors.getByIdInternal, {
                id: item.subcontractor_id as Id<"subcontractors">,
              })
              if (!subcontractor) continue

              // Send to subcontractor's contact email (not broker)
              const recipientEmail = subcontractor.contactEmail
              if (!recipientEmail) {
                errors.push(`No contact email for subcontractor ${item.subcontractor_name}`)
                continue
              }

              // Check if we already sent this follow-up number
              const existingFollowups = await ctx.runQuery(
                internal.communications.getFollowUpCount,
                {
                  verificationId: item.verification_id as Id<"verifications">,
                }
              )
              if (existingFollowups >= followUpNumber) continue

              // Handle escalation at 10+ days
              if (shouldEscalate) {
                // Mark as escalated
                await ctx.runMutation(internal.communications.escalate, {
                  verificationId: item.verification_id as Id<"verifications">,
                })

                // Notify admins - subcontractor isn't responding
                for (const admin of admins) {
                  await ctx.runMutation(internal.notifications.createInternal, {
                    userId: admin._id,
                    companyId: company._id,
                    type: "communication_sent",
                    title: "Subcontractor Response Required",
                    message: `${item.subcontractor_name} hasn't responded after ${daysWaiting} days - manual follow-up may be needed`,
                    link: `/dashboard/subcontractors/${item.subcontractor_id}`,
                    entityType: "subcontractor",
                    entityId: item.subcontractor_id as string,
                  })
                }

                escalated++
              }

              // Get verification for deficiencies
              const verification = await ctx.runQuery(internal.verifications.getByIdInternal, {
                id: item.verification_id as Id<"verifications">,
              })

              // Send follow-up email to subcontractor (with CC to admins)
              if (isTestMode()) {
                console.log(`[TEST MODE] Would send follow-up #${followUpNumber} to ${recipientEmail} (CC: ${adminEmails.join(", ")})`)
              } else {
                const { sendSubcontractorFollowUpEmail } = await import("../lib/resend")
                await sendSubcontractorFollowUpEmail({
                  recipientEmail,
                  recipientName: subcontractor.contactName,
                  subcontractorName: item.subcontractor_name,
                  projectName: item.project_name,
                  builderName: company.name,
                  deficiencies: verification?.deficiencies || [],
                  daysWaiting,
                  followUpNumber,
                  uploadLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://riskshield.ai"}/portal`,
                  ccEmails: adminEmails.length > 0 ? adminEmails : undefined,
                })
              }

              // Record communication
              await ctx.runMutation(internal.communications.createInternal, {
                subcontractorId: item.subcontractor_id as Id<"subcontractors">,
                projectId: item.project_id as Id<"projects">,
                verificationId: item.verification_id as Id<"verifications">,
                type: "follow_up",
                channel: "email",
                recipientEmail,
                subject: `Insurance certificate issue for ${item.project_name}`,
                status: "sent",
                sentAt: Date.now(),
                followUpCount: followUpNumber,
              })

              processed++
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              errors.push(`Follow-up for ${item.subcontractor_name}: ${msg}`)
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          errors.push(`Company ${company.name}: ${msg}`)
        }
      }

      await ctx.runMutation(internal.cronJobLogs.completeJob, {
        logId,
        status: errors.length === 0 ? "success" : errors.length < processed ? "partial" : "failed",
        recordsProcessed: processed,
        errors: errors.length > 0 ? errors : undefined,
        metadata: { followUpsSent: processed, escalated },
      })

      console.log(`[CRON] Follow-ups complete. Sent: ${processed}, Escalated: ${escalated}`)
      return { processed, escalated, errors }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await ctx.runMutation(internal.cronJobLogs.completeJob, {
        logId,
        status: "failed",
        recordsProcessed: processed,
        errors: [msg, ...errors],
      })
      throw e
    }
  },
})

// ============================================================================
// JOB D: Stop-Work Risk Alerts
// Schedule: 9:00 AM AEDT (22:00 UTC previous day)
// Purpose: Alert project managers about non-compliant subs scheduled on-site
// ============================================================================
export const runStopWorkAlerts = internalAction({
  handler: async (ctx) => {
    console.log("[CRON] Starting stop-work risk alerts...")

    const logId = await ctx.runMutation(internal.cronJobLogs.startJob, {
      jobName: "stop-work-risk-alerts",
    })

    const errors: string[] = []
    let processed = 0
    let smsSent = 0

    try {
      // Get all companies with active subscriptions
      const companies = await ctx.runQuery(internal.companies.getActiveCompanies, {})

      for (const company of companies) {
        try {
          // Get stop-work risks (non-compliant subs on-site today)
          const risks = await ctx.runQuery(api.dashboard.getStopWorkRisks, {
            companyId: company._id,
          })

          if (risks.length === 0) continue

          // Get all relevant users for notifications
          const admins = await ctx.runQuery(internal.users.getAdminsByCompany, {
            companyId: company._id,
          })

          for (const risk of risks) {
            try {
              // Check if we already sent alert for this risk today
              const alreadySent = await ctx.runQuery(
                internal.communications.checkStopWorkAlertSentToday,
                {
                  projectSubcontractorId: risk.id as Id<"projectSubcontractors">,
                }
              )
              if (alreadySent) continue

              // Get project manager if assigned
              const project = await ctx.runQuery(internal.projects.getByIdInternal, {
                id: risk.project_id as Id<"projects">,
              })

              let projectManager = null
              if (project?.projectManagerId) {
                projectManager = await ctx.runQuery(internal.users.getByIdInternal, {
                  id: project.projectManagerId,
                })
              }

              // Create high-priority notification for all admins
              for (const admin of admins) {
                await ctx.runMutation(internal.notifications.createInternal, {
                  userId: admin._id,
                  companyId: company._id,
                  type: "stop_work_risk",
                  title: "Stop Work Risk Alert",
                  message: `${risk.subcontractor_name} is non-compliant and scheduled on-site today at ${risk.project_name}`,
                  link: `/dashboard/projects/${risk.project_id}/subcontractors`,
                  entityType: "projectSubcontractor",
                  entityId: risk.id as string,
                })
              }

              // Send SMS to project manager if phone available
              if (projectManager?.phone && !isTestMode()) {
                const { sendStopWorkRiskSms } = await import("../lib/twilio")
                const result = await sendStopWorkRiskSms({
                  phoneNumber: projectManager.phone,
                  subcontractorName: risk.subcontractor_name,
                  projectName: risk.project_name,
                  reason: `Status: ${risk.status}`,
                })
                if (result.success) smsSent++
              } else if (projectManager?.phone && isTestMode()) {
                console.log(`[TEST MODE] Would send SMS to ${projectManager.phone} for stop-work risk`)
                smsSent++
              }

              // Send email to project manager
              if (projectManager?.email) {
                if (isTestMode()) {
                  console.log(`[TEST MODE] Would send stop-work email to ${projectManager.email}`)
                } else {
                  const { sendEmail } = await import("../lib/resend")
                  await sendEmail({
                    to: projectManager.email,
                    subject: `[URGENT] Stop Work Risk - ${risk.subcontractor_name}`,
                    html: `
                      <h1 style="color: #e53e3e;">Stop Work Risk Alert</h1>
                      <p><strong>${risk.subcontractor_name}</strong> is scheduled to be on-site today at <strong>${risk.project_name}</strong> but is currently <strong>non-compliant</strong>.</p>
                      <p>Please take immediate action to resolve this compliance issue before work begins.</p>
                      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${risk.project_id}/subcontractors">View Details</a></p>
                    `,
                  })
                }
              }

              processed++
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              errors.push(`Risk ${risk.subcontractor_name}: ${msg}`)
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          errors.push(`Company ${company.name}: ${msg}`)
        }
      }

      await ctx.runMutation(internal.cronJobLogs.completeJob, {
        logId,
        status: errors.length === 0 ? "success" : errors.length < processed ? "partial" : "failed",
        recordsProcessed: processed,
        errors: errors.length > 0 ? errors : undefined,
        metadata: { alertsSent: processed, smsSent },
      })

      console.log(`[CRON] Stop-work alerts complete. Alerts: ${processed}, SMS: ${smsSent}`)
      return { processed, smsSent, errors }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await ctx.runMutation(internal.cronJobLogs.completeJob, {
        logId,
        status: "failed",
        recordsProcessed: processed,
        errors: [msg, ...errors],
      })
      throw e
    }
  },
})

// ============================================================================
// JOB E: Exception Expiry Check
// Schedule: 6:30 AM AEDT (19:30 UTC previous day)
// Purpose: Expire exceptions that have passed their expiry date
// ============================================================================
export const runExceptionExpiry = internalAction({
  handler: async (ctx) => {
    console.log("[CRON] Starting exception expiry check...")

    const logId = await ctx.runMutation(internal.cronJobLogs.startJob, {
      jobName: "exception-expiry-check",
    })

    const errors: string[] = []
    let processed = 0

    try {
      // Get all active exceptions that have expired
      const expiredExceptions = await ctx.runQuery(
        internal.exceptions.getExpiredActiveExceptions,
        {}
      )

      for (const exception of expiredExceptions) {
        try {
          // Expire the exception and recalculate compliance
          await ctx.runMutation(internal.exceptions.expireAndRecalculate, {
            exceptionId: exception._id,
          })

          // Get related data for notification
          const projectSubcontractor = await ctx.runQuery(
            internal.projectSubcontractors.getByIdInternal,
            { id: exception.projectSubcontractorId }
          )

          if (projectSubcontractor) {
            const project = await ctx.runQuery(internal.projects.getByIdInternal, {
              id: projectSubcontractor.projectId,
            })
            const subcontractor = await ctx.runQuery(internal.subcontractors.getByIdInternal, {
              id: projectSubcontractor.subcontractorId,
            })

            if (project && subcontractor) {
              // Notify the user who created the exception
              await ctx.runMutation(internal.notifications.createInternal, {
                userId: exception.createdByUserId,
                companyId: project.companyId,
                type: "exception_expired",
                title: "Exception Expired",
                message: `Exception for ${subcontractor.name} on ${project.name} has expired`,
                link: `/dashboard/projects/${project._id}/subcontractors`,
                entityType: "exception",
                entityId: exception._id,
              })

              // Log to audit trail
              await ctx.runMutation(internal.auditLogs.createInternal, {
                companyId: project.companyId,
                entityType: "exception",
                entityId: exception._id,
                action: "exception_auto_expired",
                details: {
                  subcontractorName: subcontractor.name,
                  projectName: project.name,
                  expiredAt: Date.now(),
                },
              })
            }
          }

          processed++
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          errors.push(`Exception ${exception._id}: ${msg}`)
        }
      }

      await ctx.runMutation(internal.cronJobLogs.completeJob, {
        logId,
        status: errors.length === 0 ? "success" : errors.length < processed ? "partial" : "failed",
        recordsProcessed: processed,
        errors: errors.length > 0 ? errors : undefined,
      })

      console.log(`[CRON] Exception expiry complete. Expired: ${processed}`)
      return { processed, errors }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await ctx.runMutation(internal.cronJobLogs.completeJob, {
        logId,
        status: "failed",
        recordsProcessed: processed,
        errors: [msg, ...errors],
      })
      throw e
    }
  },
})

