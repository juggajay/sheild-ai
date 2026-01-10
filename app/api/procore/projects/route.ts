import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { createProcoreClient, type ProcoreProject } from '@/lib/procore'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

interface ProjectWithSyncStatus extends ProcoreProject {
  syncStatus: 'synced' | 'not_synced' | 'updated'
  shieldProjectId?: string
}

/**
 * GET /api/procore/projects
 *
 * Lists projects from Procore with their sync status.
 * Shows which projects are already synced to Shield-AI.
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

    // Admins and risk managers can view projects
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

    // Get pagination params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const perPage = parseInt(searchParams.get('per_page') || '100', 10)

    // Create Procore client with token refresh handler
    const client = createProcoreClient({
      companyId: connection.procoreCompanyId,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken || '',
      onTokenRefresh: async (tokens) => {
        // Update stored tokens in Convex
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

    // Fetch projects from Procore
    const projectsResponse = await client.getProjects({ page, per_page: perPage })

    // Get existing mappings from Convex
    const allMappings = await convex.query(api.integrations.getProcoreMappingsByCompany, {
      companyId: user.company_id as Id<"companies">,
    })

    // Filter to project mappings for this Procore company
    const projectMappings = allMappings.filter(
      m => m.procoreCompanyId === connection.procoreCompanyId && m.procoreEntityType === 'project'
    )

    const mappingsByProcoreId = new Map(
      projectMappings.map(m => [m.procoreEntityId, m.shieldEntityId])
    )

    // Add sync status to projects
    const projectsWithStatus: ProjectWithSyncStatus[] = projectsResponse.data.map(project => ({
      ...project,
      syncStatus: mappingsByProcoreId.has(project.id) ? 'synced' : 'not_synced',
      shieldProjectId: mappingsByProcoreId.get(project.id),
    }))

    return NextResponse.json({
      projects: projectsWithStatus,
      pagination: {
        page,
        perPage,
        hasMore: projectsResponse.hasMore,
        total: projectsResponse.total,
      },
      procoreCompany: {
        id: connection.procoreCompanyId,
        name: connection.procoreCompanyName,
      },
    })
  } catch (error) {
    console.error('Procore projects error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Procore projects' },
      { status: 500 }
    )
  }
}
