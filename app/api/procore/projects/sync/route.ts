import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { createProcoreClient } from '@/lib/procore'
import { syncProjectsFromProcoreConvex } from '@/lib/procore/sync-convex'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

interface SyncProjectsBody {
  projectIds: number[]
  updateExisting?: boolean
}

/**
 * POST /api/procore/projects/sync
 *
 * Syncs selected projects from Procore to Shield-AI.
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

    // Only admins can sync projects
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json() as SyncProjectsBody
    const { projectIds, updateExisting = true } = body

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({
        error: 'projectIds is required and must be a non-empty array of numbers',
      }, { status: 400 })
    }

    // Validate all IDs are numbers
    if (!projectIds.every(id => typeof id === 'number' && id > 0)) {
      return NextResponse.json({
        error: 'All projectIds must be positive numbers',
      }, { status: 400 })
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

    // Sync projects using Convex
    console.log(`[Procore Sync] Starting project sync for ${projectIds.length} projects`)
    const result = await syncProjectsFromProcoreConvex(
      convex,
      client,
      user.company_id!,
      projectIds,
      { updateExisting }
    )

    // Create audit log entry
    await convex.mutation(api.auditLogs.create, {
      companyId: user.company_id as Id<"companies">,
      userId: user.id as Id<"users">,
      entityType: 'integration',
      entityId: 'procore',
      action: 'sync_projects',
      details: {
        projectIds,
        total: result.total,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
        duration_ms: result.duration_ms,
      },
    })

    console.log(`[Procore Sync] Project sync completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`)

    return NextResponse.json({
      success: true,
      message: `Synced ${result.created + result.updated} project(s) from Procore`,
      result,
    })
  } catch (error) {
    console.error('Procore project sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync projects from Procore' },
      { status: 500 }
    )
  }
}
