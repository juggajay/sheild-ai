import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// GET /api/project-subcontractors - List all project-subcontractor assignments
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

    // Get project subcontractors based on user role
    const filterByProjectManagerOnly = ['project_manager', 'project_administrator'].includes(user.role)

    const projectSubcontractors = await convex.query(
      api.projectSubcontractors.listByCompanyWithRoleFilter,
      {
        companyId: user.company_id as Id<"companies">,
        userId: filterByProjectManagerOnly ? user.id as Id<"users"> : undefined,
        filterByProjectManagerOnly,
      }
    )

    return NextResponse.json({
      projectSubcontractors,
      total: projectSubcontractors.length,
    })
  } catch (error) {
    console.error('Get project-subcontractors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
