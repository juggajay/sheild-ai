import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { createProcoreClient, extractABNFromVendor, type ProcoreVendor } from '@/lib/procore'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

interface VendorWithSyncStatus extends ProcoreVendor {
  syncStatus: 'synced' | 'not_synced' | 'abn_conflict'
  shieldSubcontractorId?: string
  extractedABN: string | null
  conflictDetails?: {
    existingId: string
    existingName: string
  }
}

/**
 * GET /api/procore/vendors
 *
 * Lists vendors from Procore company directory with sync status.
 * Includes ABN extraction and conflict detection.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const token = (await cookieStore).get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admins and risk managers can view vendors
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin or risk manager access required' }, { status: 403 })
    }

    // Get Procore connection from Convex
    const connection = await convex.query(api.integrations.getConnection, {
      companyId: user.company_id as Id<"companies">,
      provider: 'procore',
    })

    if (!connection) {
      return NextResponse.json({
        error: 'Procore not connected. Please connect first.',
        needsConnection: true,
      }, { status: 404 })
    }

    if (connection.pendingCompanySelection || !connection.procoreCompanyId) {
      return NextResponse.json({
        error: 'Please select a Procore company first.',
        needsCompanySelection: true,
      }, { status: 400 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const perPage = parseInt(searchParams.get('per_page') || '100', 10)
    const projectId = searchParams.get('project_id')
    const activeOnly = searchParams.get('active') !== 'false'

    // Create Procore client with token refresh handler
    const client = createProcoreClient({
      companyId: connection.procoreCompanyId,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken || '',
      onTokenRefresh: async (tokens) => {
        const tokenExpiresAt = Date.now() + (tokens.expires_in || 7200) * 1000
        await convex.mutation(api.integrations.updateConnectionTokens, {
          companyId: user.company_id as Id<"companies">,
          provider: 'procore',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt,
        })
      },
    })

    // Fetch vendors from Procore
    let vendorsResponse
    if (projectId) {
      // Get project-specific vendors
      vendorsResponse = await client.getProjectVendors(parseInt(projectId, 10), { page, per_page: perPage })
    } else {
      // Get company directory vendors
      vendorsResponse = await client.getVendors({ page, per_page: perPage, isActive: activeOnly })
    }

    // Get all mappings from Convex
    const allMappings = await convex.query(api.integrations.getProcoreMappingsByCompany, {
      companyId: user.company_id as Id<"companies">,
    })

    // Filter to vendor mappings for this Procore company
    const vendorMappings = allMappings.filter(
      m => m.procoreCompanyId === connection.procoreCompanyId && m.procoreEntityType === 'vendor'
    )

    const mappingsByProcoreId = new Map(
      vendorMappings.map(m => [m.procoreEntityId, m.shieldEntityId])
    )

    // Extract ABNs and check for conflicts
    const abnsToCheck: string[] = []
    const vendorABNs = new Map<number, string>()

    for (const vendor of vendorsResponse.data) {
      const abn = extractABNFromVendor(vendor)
      if (abn) {
        vendorABNs.set(vendor.id, abn)
        if (!mappingsByProcoreId.has(vendor.id)) {
          abnsToCheck.push(abn)
        }
      }
    }

    // Check for ABN conflicts using Convex
    const abnConflicts = new Map<string, { id: string; name: string }>()
    if (abnsToCheck.length > 0) {
      const existingSubcontractors = await convex.query(api.subcontractors.getByAbns, {
        companyId: user.company_id as Id<"companies">,
        abns: abnsToCheck,
      })

      for (const sub of existingSubcontractors) {
        if (sub.abn) {
          abnConflicts.set(sub.abn, { id: sub._id, name: sub.name })
        }
      }
    }

    // Build response with sync status
    const vendorsWithStatus: VendorWithSyncStatus[] = vendorsResponse.data.map(vendor => {
      const extractedABN = vendorABNs.get(vendor.id) || null
      const shieldSubcontractorId = mappingsByProcoreId.get(vendor.id)

      let syncStatus: 'synced' | 'not_synced' | 'abn_conflict' = 'not_synced'
      let conflictDetails: VendorWithSyncStatus['conflictDetails']

      if (shieldSubcontractorId) {
        syncStatus = 'synced'
      } else if (extractedABN && abnConflicts.has(extractedABN)) {
        syncStatus = 'abn_conflict'
        const conflict = abnConflicts.get(extractedABN)!
        conflictDetails = {
          existingId: conflict.id,
          existingName: conflict.name,
        }
      }

      return {
        ...vendor,
        syncStatus,
        shieldSubcontractorId,
        extractedABN,
        conflictDetails,
      }
    })

    // Summary stats
    const stats = {
      total: vendorsWithStatus.length,
      synced: vendorsWithStatus.filter(v => v.syncStatus === 'synced').length,
      notSynced: vendorsWithStatus.filter(v => v.syncStatus === 'not_synced').length,
      abnConflicts: vendorsWithStatus.filter(v => v.syncStatus === 'abn_conflict').length,
      withABN: vendorsWithStatus.filter(v => v.extractedABN).length,
      withoutABN: vendorsWithStatus.filter(v => !v.extractedABN).length,
    }

    return NextResponse.json({
      vendors: vendorsWithStatus,
      stats,
      pagination: {
        page,
        perPage,
        hasMore: vendorsResponse.hasMore,
        total: vendorsResponse.total,
      },
      procoreCompany: {
        id: connection.procoreCompanyId,
        name: connection.procoreCompanyName,
      },
    })
  } catch (error) {
    console.error('Procore vendors error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch Procore vendors', details: errorMessage },
      { status: 500 }
    )
  }
}
