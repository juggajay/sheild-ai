import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// GET /api/requirement-templates - Get all requirement templates
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

    const result = await convex.query(api.requirementTemplates.listByCompany, {
      companyId: user.company_id as Id<"companies">,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get requirement templates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/requirement-templates - Create a custom template
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

    // Only admin and risk_manager can create templates
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins and risk managers can create templates' }, { status: 403 })
    }

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const body = await request.json()
    const { name, requirements } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }

    if (!Array.isArray(requirements) || requirements.length === 0) {
      return NextResponse.json({ error: 'At least one requirement is required' }, { status: 400 })
    }

    const templateId = await convex.mutation(api.requirementTemplates.create, {
      companyId: user.company_id as Id<"companies">,
      name: name.trim(),
      requirements,
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.company_id as Id<"companies">,
      userId: user.id as Id<"users">,
      entityType: 'requirement_template',
      entityId: templateId,
      action: 'create',
      details: { name },
    })

    const template = await convex.query(api.requirementTemplates.getById, {
      id: templateId,
    })

    return NextResponse.json({
      success: true,
      message: 'Requirement template created',
      template: template ? {
        id: template._id,
        company_id: template.companyId,
        name: template.name,
        type: template.type,
        requirements: template.requirements,
        is_default: template.isDefault,
        is_standard: false,
      } : null,
    }, { status: 201 })
  } catch (error) {
    console.error('Create requirement template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
