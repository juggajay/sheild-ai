import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken, verifyPassword } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Helper function to check and update expired exceptions
async function checkExpiredExceptions(companyId: string) {
  try {
    // Use Convex mutation to expire old exceptions
    await convex.mutation(api.exceptions.expireOld, {})
  } catch (error) {
    console.error('Error expiring exceptions:', error)
  }
}

// GET /api/exceptions - List all exceptions for the company
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    // Check and update any expired exceptions for this company
    await checkExpiredExceptions(user.company_id)

    // Get exceptions based on user role
    const filterByProjectManagerOnly = ['project_manager', 'project_administrator'].includes(user.role)

    const result = await convex.query(api.exceptions.listByCompany, {
      companyId: user.company_id as Id<"companies">,
      filterByUserId: filterByProjectManagerOnly ? user.id as Id<"users"> : undefined,
      filterByProjectManagerOnly,
    })

    return NextResponse.json({
      exceptions: result.exceptions,
      total: result.total,
    })
  } catch (error) {
    console.error('Get exceptions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/exceptions - Create a new exception
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admin, risk_manager, and project_manager can create exceptions
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to create exceptions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      projectSubcontractorId,
      verificationId,
      issueSummary,
      reason,
      riskLevel,
      expirationType,
      expiresAt,
      password // Required for permanent exceptions
    } = body

    // Validate required fields
    if (!projectSubcontractorId || !issueSummary || !reason) {
      return NextResponse.json({ error: 'Project subcontractor ID, issue summary, and reason are required' }, { status: 400 })
    }

    // Validate expiration type
    const validExpirationTypes = ['until_resolved', 'fixed_duration', 'specific_date', 'permanent']
    if (expirationType && !validExpirationTypes.includes(expirationType)) {
      return NextResponse.json({ error: 'Invalid expiration type' }, { status: 400 })
    }

    // SECURITY: Permanent exceptions require password confirmation
    if (expirationType === 'permanent') {
      if (!password) {
        return NextResponse.json({
          error: 'Password confirmation required for permanent exceptions',
          requiresPassword: true
        }, { status: 400 })
      }

      // Verify password
      const userWithPassword = await convex.query(api.users.getByEmailInternal, { email: user.email })
      if (!userWithPassword) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const passwordValid = await verifyPassword(password, userWithPassword.passwordHash)
      if (!passwordValid) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
      }
    }

    // Verify project_subcontractor exists and user has access
    const projectSubcontractor = await convex.query(api.projectSubcontractors.getByIdWithProject, {
      id: projectSubcontractorId as Id<"projectSubcontractors">,
    })

    if (!projectSubcontractor) {
      return NextResponse.json({ error: 'Project subcontractor not found' }, { status: 404 })
    }

    if (projectSubcontractor.companyId !== user.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Project managers can only create exceptions for their assigned projects
    if (user.role === 'project_manager' && projectSubcontractor.projectManagerId !== user.id) {
      return NextResponse.json({ error: 'You can only create exceptions for your assigned projects' }, { status: 403 })
    }

    // Create exception
    const validRiskLevels = ['low', 'medium', 'high']
    const finalRiskLevel = riskLevel && validRiskLevels.includes(riskLevel) ? riskLevel : 'medium'

    // Risk managers and admins auto-approve their own exceptions
    const autoApprove = ['admin', 'risk_manager'].includes(user.role)

    const result = await convex.mutation(api.exceptions.createWithAutoApproval, {
      projectSubcontractorId: projectSubcontractorId as Id<"projectSubcontractors">,
      verificationId: verificationId ? verificationId as Id<"verifications"> : undefined,
      issueSummary: issueSummary.trim(),
      reason: reason.trim(),
      riskLevel: finalRiskLevel as 'low' | 'medium' | 'high',
      createdByUserId: user.id as Id<"users">,
      expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
      expirationType: (expirationType || 'until_resolved') as 'until_resolved' | 'fixed_duration' | 'specific_date' | 'permanent',
      autoApprove,
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.company_id as Id<"companies">,
      userId: user.id as Id<"users">,
      entityType: 'exception',
      entityId: result.exceptionId,
      action: 'create',
      details: {
        issueSummary: issueSummary.trim(),
        riskLevel: finalRiskLevel,
        expirationType: expirationType || 'until_resolved',
        permanent: expirationType === 'permanent',
      },
    })

    // Get the created exception with full details
    const exception = await convex.query(api.exceptions.getByIdWithDetails, {
      id: result.exceptionId,
    })

    return NextResponse.json({
      success: true,
      message: `Exception ${autoApprove ? 'created and approved' : 'created and pending approval'}`,
      exception,
    }, { status: 201 })

  } catch (error) {
    console.error('Create exception error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/exceptions - Approve or reject an exception
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admin and risk_manager can approve exceptions
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to approve exceptions' }, { status: 403 })
    }

    const body = await request.json()
    const { exceptionId, action } = body

    if (!exceptionId) {
      return NextResponse.json({ error: 'Exception ID is required' }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be approve or reject' }, { status: 400 })
    }

    // Get exception with company verification
    const exception = await convex.query(api.exceptions.getByIdWithDetails, {
      id: exceptionId as Id<"exceptions">,
    })

    if (!exception) {
      return NextResponse.json({ error: 'Exception not found' }, { status: 404 })
    }

    if (exception.project_company_id !== user.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (exception.status !== 'pending_approval') {
      return NextResponse.json({ error: 'Exception is not pending approval' }, { status: 400 })
    }

    // Update exception status
    if (action === 'approve') {
      await convex.mutation(api.exceptions.approve, {
        id: exceptionId as Id<"exceptions">,
        approvedByUserId: user.id as Id<"users">,
      })

      // Update project_subcontractor status to 'exception'
      await convex.mutation(api.projectSubcontractors.updateStatus, {
        id: exception.projectSubcontractorId as Id<"projectSubcontractors">,
        status: 'exception',
      })
    } else {
      await convex.mutation(api.exceptions.reject, {
        id: exceptionId as Id<"exceptions">,
        rejectedByUserId: user.id as Id<"users">,
      })
    }

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.company_id as Id<"companies">,
      userId: user.id as Id<"users">,
      entityType: 'exception',
      entityId: exceptionId,
      action,
      details: {
        previousStatus: 'pending_approval',
        newStatus: action === 'approve' ? 'active' : 'rejected',
      },
    })

    // Get updated exception
    const updatedException = await convex.query(api.exceptions.getByIdWithDetails, {
      id: exceptionId as Id<"exceptions">,
    })

    return NextResponse.json({
      success: true,
      message: `Exception ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      exception: updatedException,
    })

  } catch (error) {
    console.error('Update exception error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
