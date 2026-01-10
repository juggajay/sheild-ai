import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { pushComplianceToProcoreConvex, getCompliancePushHistoryConvex } from '@/lib/procore/hooks-convex'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

interface PushComplianceBody {
  subcontractorId: string
  verificationId?: string // If not provided, uses the latest verification
}

/**
 * POST /api/procore/push-compliance
 *
 * Manually triggers a compliance status push to Procore for a subcontractor.
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

    // Only admins and risk managers can push compliance
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Admin or risk manager access required' }, { status: 403 })
    }

    const body = await request.json() as PushComplianceBody
    let { subcontractorId, verificationId } = body

    if (!subcontractorId) {
      return NextResponse.json({
        error: 'subcontractorId is required',
      }, { status: 400 })
    }

    // Verify subcontractor exists and belongs to user's company using Convex
    const subcontractor = await convex.query(api.subcontractors.getById, {
      id: subcontractorId as Id<"subcontractors">,
    })

    if (!subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    if (subcontractor.companyId !== user.company_id) {
      return NextResponse.json({ error: 'Access denied to this subcontractor' }, { status: 403 })
    }

    // If no verification ID provided, get the latest one
    if (!verificationId) {
      const latestVerification = await convex.query(api.verifications.getLatestBySubcontractor, {
        subcontractorId: subcontractorId as Id<"subcontractors">,
      })

      if (!latestVerification) {
        return NextResponse.json({
          error: 'No verifications found for this subcontractor',
        }, { status: 404 })
      }

      verificationId = latestVerification._id
    }

    // Push compliance status using Convex
    const result = await pushComplianceToProcoreConvex(
      convex,
      user.company_id!,
      subcontractorId,
      verificationId
    )

    if (result.pushed) {
      return NextResponse.json({
        success: true,
        message: result.message,
        procoreVendorId: result.procoreVendorId,
      })
    } else {
      return NextResponse.json({
        success: false,
        message: result.message,
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Procore push compliance error:', error)
    return NextResponse.json(
      { error: 'Failed to push compliance to Procore' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/procore/push-compliance
 *
 * Gets the compliance push history for a subcontractor.
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

    const { searchParams } = new URL(request.url)
    const subcontractorId = searchParams.get('subcontractorId')

    if (!subcontractorId) {
      return NextResponse.json({
        error: 'subcontractorId query parameter is required',
      }, { status: 400 })
    }

    // Verify subcontractor belongs to user's company using Convex
    const subcontractor = await convex.query(api.subcontractors.getById, {
      id: subcontractorId as Id<"subcontractors">,
    })

    if (!subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    if (subcontractor.companyId !== user.company_id) {
      return NextResponse.json({ error: 'Access denied to this subcontractor' }, { status: 403 })
    }

    // Get push history using Convex
    const history = await getCompliancePushHistoryConvex(
      convex,
      user.company_id!,
      subcontractorId
    )

    return NextResponse.json({
      history,
    })
  } catch (error) {
    console.error('Procore push compliance history error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch compliance push history' },
      { status: 500 }
    )
  }
}
