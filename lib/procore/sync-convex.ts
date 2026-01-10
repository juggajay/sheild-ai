/**
 * Procore Sync Module (Convex Version)
 *
 * Handles synchronization of data between Procore and Shield-AI using Convex:
 * - Projects: Import from Procore to Shield-AI
 * - Vendors: Import from Procore to Shield-AI subcontractors
 */

import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { ProcoreClient } from './client'
import type {
  ProcoreProject,
  ProcoreVendor,
  ProcoreSyncResult,
  ProcoreSyncBatchResult,
} from './types'
import { isAustralianStateCode, extractABNFromVendor } from './types'

// ============================================================================
// Types
// ============================================================================

export interface ProjectSyncOptions {
  updateExisting?: boolean
}

export interface VendorSyncOptions {
  projectId?: string
  skipDuplicates?: boolean
  mergeExisting?: boolean
}

type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT'

// ============================================================================
// Project Sync
// ============================================================================

/**
 * Map Procore project fields to Shield-AI project fields
 */
function mapProcoreProject(
  procoreProject: ProcoreProject,
  companyId: string
): {
  companyId: Id<"companies">
  name: string
  address: string | null
  state: AustralianState | null
  status: 'active' | 'completed' | 'on_hold'
  startDate: number | null
  endDate: number | null
} {
  const stateCode = procoreProject.state_code
  const mappedState = stateCode && isAustralianStateCode(stateCode)
    ? stateCode as AustralianState
    : null

  const addressParts = [
    procoreProject.address,
    procoreProject.city,
    stateCode,
    procoreProject.zip,
  ].filter(Boolean)
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null

  // Convert date strings to timestamps
  const startDateStr = procoreProject.estimated_start_date || procoreProject.actual_start_date
  const endDateStr = procoreProject.estimated_completion_date || procoreProject.projected_finish_date

  return {
    companyId: companyId as Id<"companies">,
    name: procoreProject.name,
    address: fullAddress,
    state: mappedState,
    status: procoreProject.active ? 'active' : 'completed',
    startDate: startDateStr ? new Date(startDateStr).getTime() : null,
    endDate: endDateStr ? new Date(endDateStr).getTime() : null,
  }
}

/**
 * Sync selected projects from Procore to Shield-AI using Convex
 */
export async function syncProjectsFromProcoreConvex(
  convex: ConvexHttpClient,
  client: ProcoreClient,
  companyId: string,
  projectIds: number[],
  options: ProjectSyncOptions = {}
): Promise<ProcoreSyncBatchResult> {
  const { updateExisting = true } = options
  const startTime = Date.now()
  const results: ProcoreSyncResult[] = []
  const procoreCompanyId = client.getCompanyId()

  // Get existing mappings from Convex
  const allMappings = await convex.query(api.integrations.getProcoreMappingsByCompany, {
    companyId: companyId as Id<"companies">,
  })

  const projectMappings = allMappings.filter(
    m => m.procoreCompanyId === procoreCompanyId && m.procoreEntityType === 'project'
  )

  const mappingsByProcoreId = new Map(
    projectMappings.map(m => [m.procoreEntityId, { id: m._id, shieldEntityId: m.shieldEntityId }])
  )

  // Log sync start
  const syncLogId = await convex.mutation(api.integrations.createSyncLog, {
    companyId: companyId as Id<"companies">,
    procoreCompanyId,
    syncType: 'projects',
    status: 'started',
    totalItems: projectIds.length,
  })

  try {
    for (const projectId of projectIds) {
      try {
        const procoreProject = await client.getProject(projectId)

        if (!procoreProject) {
          results.push({
            success: false,
            operation: 'error',
            procore_id: projectId,
            shield_id: null,
            entity_type: 'project',
            message: 'Project not found in Procore',
          })
          continue
        }

        const existingMapping = mappingsByProcoreId.get(projectId)

        if (existingMapping) {
          if (updateExisting) {
            const projectData = mapProcoreProject(procoreProject, companyId)

            // Update existing project
            await convex.mutation(api.projects.update, {
              id: existingMapping.shieldEntityId as Id<"projects">,
              name: projectData.name,
              address: projectData.address || undefined,
              state: projectData.state || undefined,
              status: projectData.status,
              startDate: projectData.startDate || undefined,
              endDate: projectData.endDate || undefined,
            })

            // Update mapping timestamp
            await convex.mutation(api.integrations.upsertProcoreMapping, {
              companyId: companyId as Id<"companies">,
              procoreCompanyId,
              procoreEntityType: 'project',
              procoreEntityId: projectId,
              shieldEntityType: 'project',
              shieldEntityId: existingMapping.shieldEntityId,
              syncDirection: 'procore_to_shield',
              syncStatus: 'active',
            })

            results.push({
              success: true,
              operation: 'update',
              procore_id: projectId,
              shield_id: existingMapping.shieldEntityId,
              entity_type: 'project',
              message: `Updated project: ${procoreProject.name}`,
            })
          } else {
            results.push({
              success: true,
              operation: 'skip',
              procore_id: projectId,
              shield_id: existingMapping.shieldEntityId,
              entity_type: 'project',
              message: `Skipped (already exists): ${procoreProject.name}`,
            })
          }
        } else {
          const projectData = mapProcoreProject(procoreProject, companyId)

          // Create new project
          const shieldProjectId = await convex.mutation(api.projects.create, {
            companyId: projectData.companyId,
            name: projectData.name,
            address: projectData.address || undefined,
            state: projectData.state || undefined,
            status: projectData.status,
            startDate: projectData.startDate || undefined,
            endDate: projectData.endDate || undefined,
          })

          // Create mapping
          await convex.mutation(api.integrations.upsertProcoreMapping, {
            companyId: companyId as Id<"companies">,
            procoreCompanyId,
            procoreEntityType: 'project',
            procoreEntityId: projectId,
            shieldEntityType: 'project',
            shieldEntityId: shieldProjectId,
            syncDirection: 'procore_to_shield',
            syncStatus: 'active',
          })

          results.push({
            success: true,
            operation: 'create',
            procore_id: projectId,
            shield_id: shieldProjectId,
            entity_type: 'project',
            message: `Created project: ${procoreProject.name}`,
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          success: false,
          operation: 'error',
          procore_id: projectId,
          shield_id: null,
          entity_type: 'project',
          message: `Error syncing project ${projectId}: ${errorMessage}`,
        })
      }
    }

    const duration = Date.now() - startTime
    const created = results.filter(r => r.operation === 'create').length
    const updated = results.filter(r => r.operation === 'update').length
    const skipped = results.filter(r => r.operation === 'skip').length
    const errors = results.filter(r => r.operation === 'error').length

    // Update sync log
    await convex.mutation(api.integrations.updateSyncLog, {
      id: syncLogId,
      status: 'completed',
      createdCount: created,
      updatedCount: updated,
      skippedCount: skipped,
      errorCount: errors,
    })

    return {
      total: projectIds.length,
      created,
      updated,
      skipped,
      errors,
      results,
      duration_ms: duration,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await convex.mutation(api.integrations.updateSyncLog, {
      id: syncLogId,
      status: 'failed',
      errorMessage,
    })

    throw error
  }
}

// ============================================================================
// Vendor Sync
// ============================================================================

/**
 * Map Procore vendor fields to Shield-AI subcontractor fields
 * Uses Convex schema field names (contactEmail, contactPhone, etc.)
 */
function mapProcoreVendor(
  procoreVendor: ProcoreVendor,
  companyId: string
): {
  companyId: Id<"companies">
  name: string
  abn: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  trade: string | null
  workersCompState: string | null
} {
  const abn = extractABNFromVendor(procoreVendor)
  const state = procoreVendor.state_code
  const mappedState = state && isAustralianStateCode(state) ? state : null

  // Get primary contact info
  const contactName = procoreVendor.primary_contact?.name || null

  return {
    companyId: companyId as Id<"companies">,
    name: procoreVendor.name,
    abn,
    contactName,
    contactEmail: procoreVendor.email_address || procoreVendor.primary_contact?.email_address || null,
    contactPhone: procoreVendor.business_phone || procoreVendor.primary_contact?.business_phone || null,
    address: [procoreVendor.address, procoreVendor.city, procoreVendor.state_code, procoreVendor.zip]
      .filter(Boolean)
      .join(', ') || null,
    trade: null, // Procore doesn't have a direct trade field
    workersCompState: mappedState,
  }
}

/**
 * Sync selected vendors from Procore to Shield-AI using Convex
 */
export async function syncVendorsFromProcoreConvex(
  convex: ConvexHttpClient,
  client: ProcoreClient,
  companyId: string,
  vendorIds: number[],
  options: VendorSyncOptions = {}
): Promise<ProcoreSyncBatchResult> {
  const { projectId, skipDuplicates = false, mergeExisting = true } = options
  const startTime = Date.now()
  const results: ProcoreSyncResult[] = []
  const procoreCompanyId = client.getCompanyId()

  // Get existing mappings
  const allMappings = await convex.query(api.integrations.getProcoreMappingsByCompany, {
    companyId: companyId as Id<"companies">,
  })

  const vendorMappings = allMappings.filter(
    m => m.procoreCompanyId === procoreCompanyId && m.procoreEntityType === 'vendor'
  )

  const mappingsByProcoreId = new Map(
    vendorMappings.map(m => [m.procoreEntityId, { id: m._id, shieldEntityId: m.shieldEntityId }])
  )

  // Get existing subcontractors by ABN for deduplication
  const existingSubcontractors = await convex.query(api.subcontractors.getByCompany, {
    companyId: companyId as Id<"companies">,
  })

  const subcontractorsByABN = new Map(
    existingSubcontractors
      .filter(s => s.abn)
      .map(s => [s.abn!, { id: s._id, name: s.name }])
  )

  // Log sync start
  const syncLogId = await convex.mutation(api.integrations.createSyncLog, {
    companyId: companyId as Id<"companies">,
    procoreCompanyId,
    syncType: 'vendors',
    status: 'started',
    totalItems: vendorIds.length,
  })

  try {
    for (const vendorId of vendorIds) {
      try {
        const procoreVendor = await client.getVendor(vendorId)

        if (!procoreVendor) {
          results.push({
            success: false,
            operation: 'error',
            procore_id: vendorId,
            shield_id: null,
            entity_type: 'vendor',
            message: 'Vendor not found in Procore',
          })
          continue
        }

        const vendorData = mapProcoreVendor(procoreVendor, companyId)
        const existingMapping = mappingsByProcoreId.get(vendorId)

        if (existingMapping) {
          if (mergeExisting) {
            // Update existing subcontractor
            await convex.mutation(api.subcontractors.update, {
              id: existingMapping.shieldEntityId as Id<"subcontractors">,
              name: vendorData.name,
              abn: vendorData.abn || undefined,
              contactName: vendorData.contactName || undefined,
              contactEmail: vendorData.contactEmail || undefined,
              contactPhone: vendorData.contactPhone || undefined,
              address: vendorData.address || undefined,
              trade: vendorData.trade || undefined,
              workersCompState: vendorData.workersCompState || undefined,
            })

            // Update mapping timestamp
            await convex.mutation(api.integrations.upsertProcoreMapping, {
              companyId: companyId as Id<"companies">,
              procoreCompanyId,
              procoreEntityType: 'vendor',
              procoreEntityId: vendorId,
              shieldEntityType: 'subcontractor',
              shieldEntityId: existingMapping.shieldEntityId,
              syncDirection: 'procore_to_shield',
              syncStatus: 'active',
            })

            results.push({
              success: true,
              operation: 'update',
              procore_id: vendorId,
              shield_id: existingMapping.shieldEntityId,
              entity_type: 'vendor',
              message: `Updated subcontractor: ${procoreVendor.name}`,
            })
          } else {
            results.push({
              success: true,
              operation: 'skip',
              procore_id: vendorId,
              shield_id: existingMapping.shieldEntityId,
              entity_type: 'vendor',
              message: `Skipped (already synced): ${procoreVendor.name}`,
            })
          }
          continue
        }

        // Check for ABN duplicate
        if (vendorData.abn) {
          const existingByABN = subcontractorsByABN.get(vendorData.abn)

          if (existingByABN) {
            if (skipDuplicates) {
              results.push({
                success: true,
                operation: 'skip',
                procore_id: vendorId,
                shield_id: existingByABN.id,
                entity_type: 'vendor',
                message: `Skipped (ABN duplicate): ${procoreVendor.name} - existing: ${existingByABN.name}`,
              })
              continue
            }

            if (mergeExisting) {
              // Merge with existing subcontractor
              await convex.mutation(api.subcontractors.update, {
                id: existingByABN.id as Id<"subcontractors">,
                contactName: vendorData.contactName || undefined,
                contactEmail: vendorData.contactEmail || undefined,
                contactPhone: vendorData.contactPhone || undefined,
                address: vendorData.address || undefined,
                trade: vendorData.trade || undefined,
                workersCompState: vendorData.workersCompState || undefined,
              })

              // Create mapping to existing subcontractor
              await convex.mutation(api.integrations.upsertProcoreMapping, {
                companyId: companyId as Id<"companies">,
                procoreCompanyId,
                procoreEntityType: 'vendor',
                procoreEntityId: vendorId,
                shieldEntityType: 'subcontractor',
                shieldEntityId: existingByABN.id,
                syncDirection: 'procore_to_shield',
                syncStatus: 'active',
              })

              results.push({
                success: true,
                operation: 'update',
                procore_id: vendorId,
                shield_id: existingByABN.id,
                entity_type: 'vendor',
                message: `Merged with existing subcontractor: ${existingByABN.name}`,
                details: { mergedByABN: true },
              })
              continue
            }
          }
        }

        // Create new subcontractor
        const subcontractorId = await convex.mutation(api.subcontractors.create, {
          companyId: vendorData.companyId,
          name: vendorData.name,
          abn: vendorData.abn || '',
          contactName: vendorData.contactName || undefined,
          contactEmail: vendorData.contactEmail || undefined,
          contactPhone: vendorData.contactPhone || undefined,
          address: vendorData.address || undefined,
          trade: vendorData.trade || undefined,
          workersCompState: vendorData.workersCompState || undefined,
        })

        // Create mapping
        await convex.mutation(api.integrations.upsertProcoreMapping, {
          companyId: companyId as Id<"companies">,
          procoreCompanyId,
          procoreEntityType: 'vendor',
          procoreEntityId: vendorId,
          shieldEntityType: 'subcontractor',
          shieldEntityId: subcontractorId,
          syncDirection: 'procore_to_shield',
          syncStatus: 'active',
        })

        // Assign to project if specified
        if (projectId) {
          try {
            await convex.mutation(api.projectSubcontractors.create, {
              projectId: projectId as Id<"projects">,
              subcontractorId: subcontractorId as Id<"subcontractors">,
            })
          } catch {
            // Ignore if already assigned
          }
        }

        results.push({
          success: true,
          operation: 'create',
          procore_id: vendorId,
          shield_id: subcontractorId,
          entity_type: 'vendor',
          message: `Created subcontractor: ${procoreVendor.name}`,
          details: vendorData.abn ? undefined : { warning: 'No ABN found - flagged for manual entry' },
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          success: false,
          operation: 'error',
          procore_id: vendorId,
          shield_id: null,
          entity_type: 'vendor',
          message: `Error syncing vendor ${vendorId}: ${errorMessage}`,
        })
      }
    }

    const duration = Date.now() - startTime
    const created = results.filter(r => r.operation === 'create').length
    const updated = results.filter(r => r.operation === 'update').length
    const skipped = results.filter(r => r.operation === 'skip').length
    const errors = results.filter(r => r.operation === 'error').length

    // Update sync log
    await convex.mutation(api.integrations.updateSyncLog, {
      id: syncLogId,
      status: 'completed',
      createdCount: created,
      updatedCount: updated,
      skippedCount: skipped,
      errorCount: errors,
    })

    return {
      total: vendorIds.length,
      created,
      updated,
      skipped,
      errors,
      results,
      duration_ms: duration,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await convex.mutation(api.integrations.updateSyncLog, {
      id: syncLogId,
      status: 'failed',
      errorMessage,
    })

    throw error
  }
}
