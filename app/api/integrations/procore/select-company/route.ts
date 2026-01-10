import { NextRequest, NextResponse } from 'next/server'
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

interface SelectCompanyBody {
  procoreCompanyId: number
}

/**
 * POST /api/integrations/procore/select-company
 *
 * Completes the Procore connection by selecting which Procore company to use.
 * Required when the user has access to multiple Procore companies.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json() as SelectCompanyBody
    const { procoreCompanyId } = body

    if (!procoreCompanyId || typeof procoreCompanyId !== 'number') {
      return NextResponse.json({
        error: 'procoreCompanyId is required and must be a number',
      }, { status: 400 })
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

    // Verify the company ID is valid by fetching company details
    const config = getProcoreConfig()
    const isDevMode = isProcoreDevMode()

    let companyName: string

    if (isDevMode) {
      const mockCompany = MOCK_PROCORE_COMPANIES.find(c => c.id === procoreCompanyId)
      if (!mockCompany) {
        return NextResponse.json({
          error: 'Invalid Procore company ID',
        }, { status: 400 })
      }
      companyName = mockCompany.name
    } else {
      // Verify with Procore API
      const response = await fetch(`${config.apiBaseUrl}/rest/v1.0/companies`, {
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
        },
      })

      if (!response.ok) {
        return NextResponse.json({
          error: 'Failed to verify Procore company',
        }, { status: 502 })
      }

      const companies = await response.json() as Array<{ id: number; name: string }>
      const selectedCompany = companies.find(c => c.id === procoreCompanyId)

      if (!selectedCompany) {
        return NextResponse.json({
          error: 'Invalid Procore company ID - you do not have access to this company',
        }, { status: 403 })
      }

      companyName = selectedCompany.name
    }

    // Update the connection with the selected company
    await convex.mutation(api.integrations.updateProcoreCompany, {
      companyId: user.company_id as Id<"companies">,
      procoreCompanyId,
      procoreCompanyName: companyName,
    })

    // Create audit log entry
    await convex.mutation(api.auditLogs.create, {
      companyId: user.company_id as Id<"companies">,
      userId: user.id as Id<"users">,
      entityType: 'integration',
      entityId: 'procore',
      action: 'select_company',
      details: {
        procore_company_id: procoreCompanyId,
        procore_company_name: companyName,
      },
    })

    console.log(`[Procore] Company "${companyName}" (ID: ${procoreCompanyId}) selected for Shield-AI company ${user.company_id}`)

    return NextResponse.json({
      success: true,
      message: `Connected to Procore company: ${companyName}`,
      procoreCompanyId,
      procoreCompanyName: companyName,
    })
  } catch (error) {
    console.error('Procore select company error:', error)
    return NextResponse.json(
      { error: 'Failed to select Procore company' },
      { status: 500 }
    )
  }
}
