import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { createProcoreClient } from '@/lib/procore'
import { syncVendorsFromProcoreConvex } from '@/lib/procore/sync-convex'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

interface SyncVendorsBody {
  vendorIds: number[]
  projectId?: string // Shield-AI project ID to assign vendors to
  skipDuplicates?: boolean // Skip vendors with ABN conflicts
  mergeExisting?: boolean // Merge with existing subcontractors by ABN
}

/**
 * POST /api/procore/vendors/sync
 *
 * Syncs selected vendors from Procore to Shield-AI subcontractors.
 * Handles ABN conflict resolution and project assignment.
 */
export async function POST(request: NextRequest) {
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

    // Only admins can sync vendors
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json() as SyncVendorsBody
    const {
      vendorIds,
      projectId,
      skipDuplicates = false,
      mergeExisting = true,
    } = body

    if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
      return NextResponse.json({
        error: 'vendorIds is required and must be a non-empty array of numbers',
      }, { status: 400 })
    }

    // Validate all IDs are numbers
    if (!vendorIds.every(id => typeof id === 'number' && id > 0)) {
      return NextResponse.json({
        error: 'All vendorIds must be positive numbers',
      }, { status: 400 })
    }

    // Validate project if specified using Convex
    if (projectId) {
      const project = await convex.query(api.projects.getByIdForCompany, {
        id: projectId as Id<"projects">,
        companyId: user.company_id as Id<"companies">,
      })

      if (!project) {
        return NextResponse.json({
          error: 'Project not found or you do not have access',
        }, { status: 404 })
      }
    }

    // Get Procore connection from Convex
    const connection = await convex.query(api.integrations.getConnection, {
      companyId: user.company_id as Id<"companies">,
      provider: 'procore',
    })

    if (!connection) {
      return NextResponse.json({
        error: 'Procore not connected. Please connect first.',
      }, { status: 404 })
    }

    if (connection.pendingCompanySelection || !connection.procoreCompanyId) {
      return NextResponse.json({
        error: 'Please select a Procore company first.',
      }, { status: 400 })
    }

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

    // Sync vendors using Convex
    console.log(`[Procore Sync] Starting vendor sync for ${vendorIds.length} vendors`)
    const result = await syncVendorsFromProcoreConvex(
      convex,
      client,
      user.company_id!,
      vendorIds,
      { projectId, skipDuplicates, mergeExisting }
    )

    // Create audit log entry
    await convex.mutation(api.auditLogs.create, {
      companyId: user.company_id as Id<"companies">,
      userId: user.id as Id<"users">,
      entityType: 'integration',
      entityId: 'procore',
      action: 'sync_vendors',
      details: {
        vendorIds,
        projectId,
        options: { skipDuplicates, mergeExisting },
        total: result.total,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
        duration_ms: result.duration_ms,
      },
    })

    // Collect warnings for vendors without ABN
    const warnings: string[] = []
    for (const r of result.results) {
      if (r.details?.warning) {
        warnings.push(`${r.message}: ${r.details.warning}`)
      }
    }

    console.log(`[Procore Sync] Vendor sync completed: ${result.created} created, ${result.updated} updated/merged, ${result.skipped} skipped, ${result.errors} errors`)

    return NextResponse.json({
      success: true,
      message: `Synced ${result.created + result.updated} subcontractor(s) from Procore`,
      result,
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  } catch (error) {
    console.error('Procore vendor sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync vendors from Procore' },
      { status: 500 }
    )
  }
}
