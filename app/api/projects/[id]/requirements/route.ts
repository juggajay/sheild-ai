import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'

// Valid coverage types
const VALID_COVERAGE_TYPES = [
  'public_liability',
  'products_liability',
  'workers_comp',
  'professional_indemnity',
  'motor_vehicle',
  'contract_works'
] as const

type CoverageType = typeof VALID_COVERAGE_TYPES[number]

// GET /api/projects/[id]/requirements - Get project insurance requirements
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    const { id } = await params

    // Validate access to project
    const accessResult = await convex.query(api.projects.validateAccess, {
      projectId: id as Id<"projects">,
      userId: user._id,
      userRole: user.role,
      userCompanyId: user.companyId,
    })

    if (!accessResult.canAccess) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    // Get insurance requirements
    const requirements = await convex.query(api.insuranceRequirements.getByProject, {
      projectId: id as Id<"projects">,
    })

    return NextResponse.json({ requirements })
  } catch (error) {
    console.error('Get requirements error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/requirements - Add insurance requirement
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    // Only admin and risk_manager can configure requirements
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins and risk managers can configure requirements' }, { status: 403 })
    }

    const { id } = await params

    // Validate access to project
    const accessResult = await convex.query(api.projects.validateAccess, {
      projectId: id as Id<"projects">,
      userId: user._id,
      userRole: user.role,
      userCompanyId: user.companyId,
    })

    if (!accessResult.canAccess) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    const body = await request.json()
    const {
      coverage_type,
      minimum_limit,
      limit_type,
      maximum_excess,
      principal_indemnity_required,
      cross_liability_required,
      waiver_of_subrogation_required,
      principal_naming_required,
      other_requirements
    } = body

    // Validate coverage type
    if (!coverage_type || !VALID_COVERAGE_TYPES.includes(coverage_type)) {
      return NextResponse.json({
        error: `Invalid coverage type. Must be one of: ${VALID_COVERAGE_TYPES.join(', ')}`
      }, { status: 400 })
    }

    // Check if this coverage type already exists for the project
    const existing = await convex.query(api.insuranceRequirements.getByProjectAndCoverageType, {
      projectId: id as Id<"projects">,
      coverageType: coverage_type as CoverageType,
    })

    if (existing) {
      return NextResponse.json({
        error: 'This coverage type already exists for this project. Use PUT to update.'
      }, { status: 409 })
    }

    // Create requirement
    const requirementId = await convex.mutation(api.insuranceRequirements.create, {
      projectId: id as Id<"projects">,
      coverageType: coverage_type as CoverageType,
      minimumLimit: minimum_limit || undefined,
      limitType: limit_type || 'per_occurrence',
      maximumExcess: maximum_excess || undefined,
      principalIndemnityRequired: Boolean(principal_indemnity_required),
      crossLiabilityRequired: Boolean(cross_liability_required),
      waiverOfSubrogationRequired: Boolean(waiver_of_subrogation_required),
      principalNamingRequired: principal_naming_required || undefined,
      otherRequirements: other_requirements || undefined,
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.companyId,
      userId: user._id,
      entityType: 'insurance_requirement',
      entityId: requirementId,
      action: 'create',
      details: {
        project_id: id,
        coverage_type,
        minimum_limit
      },
    })

    // Get created requirement
    const requirement = await convex.query(api.insuranceRequirements.getById, { id: requirementId })

    return NextResponse.json({
      success: true,
      message: 'Insurance requirement added',
      requirement
    }, { status: 201 })

  } catch (error) {
    console.error('Create requirement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/projects/[id]/requirements - Update insurance requirements (bulk)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    // Only admin and risk_manager can configure requirements
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins and risk managers can configure requirements' }, { status: 403 })
    }

    const { id } = await params

    // Validate access to project
    const accessResult = await convex.query(api.projects.validateAccess, {
      projectId: id as Id<"projects">,
      userId: user._id,
      userRole: user.role,
      userCompanyId: user.companyId,
    })

    if (!accessResult.canAccess) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    const body = await request.json()
    const { requirements } = body

    if (!Array.isArray(requirements)) {
      return NextResponse.json({ error: 'Requirements must be an array' }, { status: 400 })
    }

    // Validate all requirements
    for (const req of requirements) {
      if (!req.coverage_type || !VALID_COVERAGE_TYPES.includes(req.coverage_type)) {
        return NextResponse.json({
          error: `Invalid coverage type: ${req.coverage_type}. Must be one of: ${VALID_COVERAGE_TYPES.join(', ')}`
        }, { status: 400 })
      }
    }

    // Bulk replace requirements
    await convex.mutation(api.insuranceRequirements.bulkReplace, {
      projectId: id as Id<"projects">,
      requirements: requirements.map((req: any) => ({
        coverageType: req.coverage_type as CoverageType,
        minimumLimit: req.minimum_limit || undefined,
        limitType: req.limit_type || 'per_occurrence',
        maximumExcess: req.maximum_excess || undefined,
        principalIndemnityRequired: Boolean(req.principal_indemnity_required),
        crossLiabilityRequired: Boolean(req.cross_liability_required),
        waiverOfSubrogationRequired: Boolean(req.waiver_of_subrogation_required),
        principalNamingRequired: req.principal_naming_required || undefined,
        otherRequirements: req.other_requirements || undefined,
      })),
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.companyId,
      userId: user._id,
      entityType: 'project',
      entityId: id,
      action: 'update_requirements',
      details: {
        requirements_count: requirements.length
      },
    })

    // Get updated requirements
    const updatedRequirements = await convex.query(api.insuranceRequirements.getByProject, {
      projectId: id as Id<"projects">,
    })

    return NextResponse.json({
      success: true,
      message: 'Insurance requirements updated',
      requirements: updatedRequirements
    })

  } catch (error) {
    console.error('Update requirements error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
