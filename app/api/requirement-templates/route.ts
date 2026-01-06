import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'

// Standard templates available to all companies
const STANDARD_TEMPLATES = [
  {
    id: 'template-commercial',
    name: 'Commercial Construction',
    type: 'commercial',
    requirements: [
      {
        coverage_type: 'public_liability',
        minimum_limit: 20000000,
        limit_type: 'per_occurrence',
        maximum_excess: 10000,
        principal_indemnity_required: true,
        cross_liability_required: true
      },
      {
        coverage_type: 'professional_indemnity',
        minimum_limit: 5000000,
        limit_type: 'per_occurrence',
        maximum_excess: 5000,
        principal_indemnity_required: false,
        cross_liability_required: false
      },
      {
        coverage_type: 'workers_comp',
        minimum_limit: null,
        limit_type: 'per_occurrence',
        maximum_excess: null,
        principal_indemnity_required: false,
        cross_liability_required: false
      }
    ]
  },
  {
    id: 'template-residential',
    name: 'Residential Construction',
    type: 'residential',
    requirements: [
      {
        coverage_type: 'public_liability',
        minimum_limit: 10000000,
        limit_type: 'per_occurrence',
        maximum_excess: 5000,
        principal_indemnity_required: true,
        cross_liability_required: false
      },
      {
        coverage_type: 'workers_comp',
        minimum_limit: null,
        limit_type: 'per_occurrence',
        maximum_excess: null,
        principal_indemnity_required: false,
        cross_liability_required: false
      }
    ]
  },
  {
    id: 'template-civil',
    name: 'Civil Infrastructure',
    type: 'civil',
    requirements: [
      {
        coverage_type: 'public_liability',
        minimum_limit: 50000000,
        limit_type: 'per_occurrence',
        maximum_excess: 20000,
        principal_indemnity_required: true,
        cross_liability_required: true
      },
      {
        coverage_type: 'professional_indemnity',
        minimum_limit: 10000000,
        limit_type: 'per_occurrence',
        maximum_excess: 10000,
        principal_indemnity_required: false,
        cross_liability_required: false
      },
      {
        coverage_type: 'workers_comp',
        minimum_limit: null,
        limit_type: 'per_occurrence',
        maximum_excess: null,
        principal_indemnity_required: false,
        cross_liability_required: false
      },
      {
        coverage_type: 'motor_vehicle',
        minimum_limit: 30000000,
        limit_type: 'per_occurrence',
        maximum_excess: 5000,
        principal_indemnity_required: false,
        cross_liability_required: false
      }
    ]
  },
  {
    id: 'template-fitout',
    name: 'Commercial Fitout',
    type: 'fitout',
    requirements: [
      {
        coverage_type: 'public_liability',
        minimum_limit: 10000000,
        limit_type: 'per_occurrence',
        maximum_excess: 5000,
        principal_indemnity_required: true,
        cross_liability_required: false
      },
      {
        coverage_type: 'workers_comp',
        minimum_limit: null,
        limit_type: 'per_occurrence',
        maximum_excess: null,
        principal_indemnity_required: false,
        cross_liability_required: false
      }
    ]
  }
]

interface DbTemplate {
  id: string
  company_id: string | null
  name: string
  type: string
  requirements: string
  is_default: number
  created_at: string
  updated_at: string
}

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

    const db = getDb()

    // Get custom templates for this company
    const customTemplates = db.prepare(`
      SELECT * FROM requirement_templates
      WHERE company_id = ?
      ORDER BY name
    `).all(user.company_id) as DbTemplate[]

    // Parse requirements JSON for custom templates
    const parsedCustomTemplates = customTemplates.map(t => ({
      ...t,
      requirements: JSON.parse(t.requirements),
      is_standard: false
    }))

    // Combine standard templates with custom templates
    const allTemplates = [
      ...STANDARD_TEMPLATES.map(t => ({
        ...t,
        company_id: null,
        is_default: 0,
        is_standard: true,
        created_at: null,
        updated_at: null
      })),
      ...parsedCustomTemplates
    ]

    return NextResponse.json({ templates: allTemplates })
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

    const body = await request.json()
    const { name, requirements } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }

    if (!Array.isArray(requirements) || requirements.length === 0) {
      return NextResponse.json({ error: 'At least one requirement is required' }, { status: 400 })
    }

    const db = getDb()
    const templateId = uuidv4()

    db.prepare(`
      INSERT INTO requirement_templates (id, company_id, name, type, requirements)
      VALUES (?, ?, ?, 'custom', ?)
    `).run(templateId, user.company_id, name.trim(), JSON.stringify(requirements))

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'requirement_template', ?, 'create', ?)
    `).run(uuidv4(), user.company_id, user.id, templateId, JSON.stringify({ name }))

    const template = db.prepare('SELECT * FROM requirement_templates WHERE id = ?').get(templateId) as DbTemplate

    return NextResponse.json({
      success: true,
      message: 'Requirement template created',
      template: {
        ...template,
        requirements: JSON.parse(template.requirements)
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Create requirement template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
