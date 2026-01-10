/**
 * Procore Integration Hooks (Convex Version)
 *
 * Functions that integrate Procore sync with Shield-AI events.
 * Called automatically after verifications complete to push status to Procore.
 */

import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { createProcoreClient, isProcoreDevMode } from './index'
import type {
  ProcoreComplianceStatus,
  ProcoreVendorInsuranceInput,
} from './types'

interface CoverageItem {
  type: string
  status: 'valid' | 'expired' | 'missing' | 'insufficient'
  expiry_date?: string
  amount?: number
  policy_number?: string
  insurer_name?: string
}

/**
 * Map Shield-AI coverage type to Procore insurance type name
 */
function mapCoverageTypeToProcore(shieldType: string): string {
  const normalized = shieldType.toLowerCase().replace(/\s+/g, '_')

  const typeMap: Record<string, string> = {
    'public_liability': 'General Liability',
    'products_liability': 'General Liability',
    'workers_comp': 'Workers Compensation',
    'workers_compensation': 'Workers Compensation',
    'professional_indemnity': 'Professional Liability',
    'motor_vehicle': 'Auto Liability',
    'contract_works': 'Builders Risk',
    'umbrella': 'Umbrella',
  }

  return typeMap[normalized] || 'General Liability'
}

/**
 * Map Shield-AI coverage status to Procore insurance status
 */
function mapCoverageStatusToProcore(
  status: CoverageItem['status']
): 'compliant' | 'non_compliant' | 'expired' | 'pending_review' {
  switch (status) {
    case 'valid':
      return 'compliant'
    case 'expired':
      return 'expired'
    case 'missing':
    case 'insufficient':
      return 'non_compliant'
    default:
      return 'pending_review'
  }
}

/**
 * Convert Shield-AI coverage items to Procore insurance inputs
 */
function convertCoverageToInsurances(
  vendorId: number,
  coverageItems: CoverageItem[],
  verificationDate: string
): ProcoreVendorInsuranceInput[] {
  return coverageItems
    .filter(item => item.status !== 'missing')
    .map(item => {
      const input: ProcoreVendorInsuranceInput = {
        vendor_id: vendorId,
        insurance_type: mapCoverageTypeToProcore(item.type),
        status: mapCoverageStatusToProcore(item.status),
        additional_insured: true,
        waiver_of_subrogation: true,
      }

      if (item.policy_number) input.policy_number = item.policy_number
      if (item.insurer_name) input.insurance_company = item.insurer_name
      if (item.amount) input.limit = item.amount
      if (item.expiry_date) input.expiration_date = item.expiry_date

      return input
    })
}

/**
 * Determine compliance status from verification results
 */
function determineComplianceStatus(
  verificationStatus: string,
  checks: Array<{ name: string; status: string; details?: string }>
): ProcoreComplianceStatus['compliance_status'] {
  if (verificationStatus === 'pass') {
    return 'compliant'
  }
  if (verificationStatus === 'pending' || verificationStatus === 'review') {
    return 'pending'
  }
  // Check if any results indicate expiration
  const hasExpired = checks.some(r =>
    r.status === 'failed' &&
    (r.details?.toLowerCase().includes('expir') || r.name?.toLowerCase().includes('expir'))
  )
  if (hasExpired) {
    return 'expired'
  }
  return 'non_compliant'
}

/**
 * Extract coverage summary from verification checks
 */
function extractCoverageSummary(
  checks: Array<{ name: string; status: string; details?: string }>
): CoverageItem[] {
  const coverage: CoverageItem[] = []

  const coverageTypes = [
    'public_liability',
    'products_liability',
    'workers_comp',
    'professional_indemnity',
    'motor_vehicle',
    'contract_works',
  ]

  for (const check of checks) {
    const checkName = (check.name || '').toLowerCase().replace(/\s+/g, '_')
    const matchedType = coverageTypes.find(type =>
      checkName.includes(type) || type.includes(checkName.split('_')[0])
    )

    if (matchedType || coverageTypes.some(t => checkName.includes(t.split('_')[0]))) {
      const type = matchedType || checkName
      let status: CoverageItem['status'] = 'valid'

      if (check.status === 'failed' || check.status === 'fail') {
        if (check.details?.toLowerCase().includes('expir')) {
          status = 'expired'
        } else if (check.details?.toLowerCase().includes('missing')) {
          status = 'missing'
        } else if (check.details?.toLowerCase().includes('insufficient') ||
                   check.details?.toLowerCase().includes('below')) {
          status = 'insufficient'
        } else {
          status = 'missing'
        }
      }

      coverage.push({ type, status })
    }
  }

  return coverage
}

/**
 * Push compliance status to Procore for a subcontractor (Convex version)
 */
export async function pushComplianceToProcoreConvex(
  convex: ConvexHttpClient,
  companyId: string,
  subcontractorId: string,
  verificationId: string
): Promise<{
  pushed: boolean
  message: string
  procoreVendorId?: number
}> {
  try {
    // Check if Procore is connected for this company
    const connection = await convex.query(api.integrations.getConnection, {
      companyId: companyId as Id<"companies">,
      provider: 'procore',
    })

    if (!connection || !connection.procoreCompanyId || connection.pendingCompanySelection) {
      return {
        pushed: false,
        message: 'Procore not connected or company not selected',
      }
    }

    // Check if subcontractor has a Procore mapping
    const mappings = await convex.query(api.integrations.getProcoreMappingsByCompany, {
      companyId: companyId as Id<"companies">,
    })

    const mapping = mappings.find(
      m => m.shieldEntityType === 'subcontractor' && m.shieldEntityId === subcontractorId
    )

    if (!mapping) {
      return {
        pushed: false,
        message: 'Subcontractor not synced from Procore - no mapping exists',
      }
    }

    // Get verification details
    const verification = await convex.query(api.verifications.getByIdWithDetails, {
      id: verificationId as Id<"verifications">,
    })

    if (!verification) {
      return {
        pushed: false,
        message: 'Verification not found',
      }
    }

    // Parse verification checks
    const checks = (verification.checks || []) as Array<{ name: string; status: string; details?: string }>

    // Build compliance status
    const complianceStatus: ProcoreComplianceStatus = {
      vendor_id: mapping.procoreEntityId,
      shield_subcontractor_id: subcontractorId,
      compliance_status: determineComplianceStatus(verification.status, checks),
      coverage_summary: extractCoverageSummary(checks),
      last_verified_at: verification.verifiedAt ? new Date(verification.verifiedAt).toISOString() : new Date().toISOString(),
      verification_id: verificationId,
    }

    // In dev mode, just log the push
    if (isProcoreDevMode()) {
      console.log('[Procore DEV] Would push compliance status:', {
        vendorId: mapping.procoreEntityId,
        status: complianceStatus.compliance_status,
        coverageCount: complianceStatus.coverage_summary.length,
      })

      // Log to audit
      await convex.mutation(api.auditLogs.create, {
        companyId: companyId as Id<"companies">,
        entityType: 'subcontractor',
        entityId: subcontractorId,
        action: 'procore_compliance_push',
        details: {
          procore_vendor_id: mapping.procoreEntityId,
          compliance_status: complianceStatus.compliance_status,
          verification_id: verificationId,
          dev_mode: true,
        },
      })

      return {
        pushed: true,
        message: '[DEV MODE] Compliance status logged (would push to Procore)',
        procoreVendorId: mapping.procoreEntityId,
      }
    }

    // Production: Push to Procore via Insurance API
    const client = createProcoreClient({
      companyId: connection.procoreCompanyId,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken || '',
      onTokenRefresh: async (tokens) => {
        const tokenExpiresAt = Date.now() + (tokens.expires_in || 7200) * 1000
        await convex.mutation(api.integrations.updateConnectionTokens, {
          companyId: companyId as Id<"companies">,
          provider: 'procore',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt,
        })
      },
    })

    // Convert coverage summary to Procore insurance records
    const insuranceInputs = convertCoverageToInsurances(
      mapping.procoreEntityId,
      complianceStatus.coverage_summary,
      complianceStatus.last_verified_at
    )

    // Sync insurance records to Procore
    let syncResult = { created: 0, updated: 0, errors: [] as string[] }
    if (insuranceInputs.length > 0) {
      syncResult = await client.syncVendorInsurances(
        mapping.procoreEntityId,
        insuranceInputs
      )
    }

    // Also update custom fields with overall status summary
    try {
      await client.updateVendorCustomFields(mapping.procoreEntityId, {
        shield_compliance_status: complianceStatus.compliance_status,
        shield_last_verified: complianceStatus.last_verified_at,
        shield_verification_id: verificationId,
      })
    } catch (customFieldError) {
      console.warn('[Procore] Could not update custom fields (may not be configured):', customFieldError)
    }

    // Log successful push
    await convex.mutation(api.auditLogs.create, {
      companyId: companyId as Id<"companies">,
      entityType: 'subcontractor',
      entityId: subcontractorId,
      action: 'procore_compliance_push',
      details: {
        procore_vendor_id: mapping.procoreEntityId,
        compliance_status: complianceStatus.compliance_status,
        verification_id: verificationId,
        insurance_sync: {
          created: syncResult.created,
          updated: syncResult.updated,
          errors: syncResult.errors,
        },
        success: true,
      },
    })

    const syncSummary = `${syncResult.created} created, ${syncResult.updated} updated`
    console.log(`[Procore] Pushed compliance status "${complianceStatus.compliance_status}" for vendor ${mapping.procoreEntityId} (${syncSummary})`)

    return {
      pushed: true,
      message: `Compliance status "${complianceStatus.compliance_status}" pushed to Procore (${syncSummary} insurance records)`,
      procoreVendorId: mapping.procoreEntityId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Log failed push
    console.error(`[Procore] Failed to push compliance status for subcontractor ${subcontractorId}:`, errorMessage)

    await convex.mutation(api.auditLogs.create, {
      companyId: companyId as Id<"companies">,
      entityType: 'subcontractor',
      entityId: subcontractorId,
      action: 'procore_compliance_push_failed',
      details: {
        error: errorMessage,
      },
    })

    return {
      pushed: false,
      message: `Failed to push to Procore: ${errorMessage}`,
    }
  }
}

/**
 * Get compliance push history for a subcontractor (Convex version)
 */
export async function getCompliancePushHistoryConvex(
  convex: ConvexHttpClient,
  companyId: string,
  subcontractorId: string,
  limit: number = 10
): Promise<Array<{
  id: string
  action: string
  details: Record<string, unknown>
  created_at: number
}>> {
  const logs = await convex.query(api.auditLogs.getByEntity, {
    entityType: 'subcontractor',
    entityId: subcontractorId,
  })

  // Filter to compliance push actions and limit
  return logs
    .filter(log =>
      log.action === 'procore_compliance_push' ||
      log.action === 'procore_compliance_push_failed'
    )
    .slice(0, limit)
    .map(log => ({
      id: log._id,
      action: log.action,
      details: log.details || {},
      created_at: log._creationTime,
    }))
}
