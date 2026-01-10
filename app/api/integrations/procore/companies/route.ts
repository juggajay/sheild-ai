import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import {
  getProcoreConfig,
  isProcoreDevMode,
  MOCK_PROCORE_COMPANIES,
} from '@/lib/procore'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

interface ProcoreCompanyResponse {
  id: number
  name: string
  is_active: boolean
  logo_url?: string | null
}

/**
 * GET /api/integrations/procore/companies
 *
 * Lists available Procore companies for the connected account.
 * Used when the user has multiple Procore companies to choose from.
 */
export async function GET() {
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

    // Get existing Procore connection
    const connection = await convex.query(api.integrations.getConnection, {
      companyId: user.company_id as Id<"companies">,
      provider: 'procore',
    })

    if (!connection) {
      return NextResponse.json({
        error: 'No Procore connection found. Please connect first.',
      }, { status: 404 })
    }

    const config = getProcoreConfig()
    const isDevMode = isProcoreDevMode()

    let companies: ProcoreCompanyResponse[]

    if (isDevMode) {
      // Return mock companies in dev mode
      companies = MOCK_PROCORE_COMPANIES.map(c => ({
        id: c.id,
        name: c.name,
        is_active: c.is_active,
        logo_url: c.logo_url,
      }))
    } else {
      // Fetch companies from Procore API
      const response = await fetch(`${config.apiBaseUrl}/rest/v1.0/companies`, {
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
        },
      })

      if (!response.ok) {
        // Token might be expired - would need refresh logic here
        console.error('Failed to fetch Procore companies:', await response.text())
        return NextResponse.json({
          error: 'Failed to fetch Procore companies. Token may have expired.',
        }, { status: 502 })
      }

      companies = await response.json()
    }

    // Filter to active companies only
    const activeCompanies = companies.filter(c => c.is_active)

    return NextResponse.json({
      companies: activeCompanies,
      selectedCompanyId: connection.procoreCompanyId,
      pendingSelection: connection.pendingCompanySelection === true,
    })
  } catch (error) {
    console.error('Procore companies error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Procore companies' },
      { status: 500 }
    )
  }
}
