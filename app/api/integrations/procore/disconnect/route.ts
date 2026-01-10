import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { cookies } from 'next/headers'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * POST /api/integrations/procore/disconnect
 *
 * Disconnects the Procore integration for the user's company.
 * Removes OAuth tokens and pauses sync mappings.
 */
export async function POST() {
  try {
    const cookieStore = cookies()
    const token = (await cookieStore).get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can manage integrations
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Delete connection (also pauses mappings)
    const result = await convex.mutation(api.integrations.deleteConnection, {
      companyId: user.company_id as Id<"companies">,
      provider: 'procore',
    })

    if (!result.deleted) {
      return NextResponse.json({ error: 'No Procore connection found' }, { status: 404 })
    }

    // Create audit log entry
    await convex.mutation(api.auditLogs.create, {
      companyId: user.company_id as Id<"companies">,
      userId: user.id as Id<"users">,
      entityType: 'integration',
      entityId: 'procore',
      action: 'disconnect',
      details: {
        procore_company_id: result.connection?.procoreCompanyId,
        procore_company_name: result.connection?.procoreCompanyName,
      },
    })

    console.log(`[Procore] Disconnected for Shield-AI company ${user.company_id}`)

    return NextResponse.json({
      success: true,
      message: 'Procore disconnected successfully',
    })
  } catch (error) {
    console.error('Procore disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Procore' },
      { status: 500 }
    )
  }
}
