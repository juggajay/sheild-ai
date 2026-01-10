import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// GET /api/company - Get current user's company profile
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

    const company = await convex.query(api.companies.getById, {
      id: user.company_id as Id<"companies">,
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Convert to legacy format for API compatibility
    return NextResponse.json({
      company: {
        id: company._id,
        name: company.name,
        abn: company.abn,
        acn: company.acn || null,
        address: company.address || null,
        logo_url: company.logoUrl || null,
        primary_contact_name: company.primaryContactName || null,
        primary_contact_email: company.primaryContactEmail || null,
        primary_contact_phone: company.primaryContactPhone || null,
        forwarding_email: company.forwardingEmail || null,
        settings: company.settings || {},
        subscription_tier: company.subscriptionTier || 'trial',
        subscription_status: company.subscriptionStatus || 'active',
        created_at: new Date(company._creationTime).toISOString(),
        updated_at: company.updatedAt ? new Date(company.updatedAt).toISOString() : null,
      }
    })
  } catch (error) {
    console.error('Get company error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/company - Update company profile (admin only)
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

    // Only admin can update company profile
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only administrators can update company profile' }, { status: 403 })
    }

    if (!user.company_id) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 404 })
    }

    const body = await request.json()
    const { name, abn, acn, address, logo_url, primary_contact_name, primary_contact_email, primary_contact_phone } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    if (!abn || typeof abn !== 'string' || abn.trim().length === 0) {
      return NextResponse.json({ error: 'ABN is required' }, { status: 400 })
    }

    // Validate ABN format (11 digits)
    const abnDigits = abn.replace(/\s/g, '')
    if (!/^\d{11}$/.test(abnDigits)) {
      return NextResponse.json({ error: 'ABN must be 11 digits' }, { status: 400 })
    }

    // Validate ACN format if provided (9 digits)
    if (acn) {
      const acnDigits = acn.replace(/\s/g, '')
      if (!/^\d{9}$/.test(acnDigits)) {
        return NextResponse.json({ error: 'ACN must be 9 digits' }, { status: 400 })
      }
    }

    // Validate email format if provided
    if (primary_contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primary_contact_email)) {
      return NextResponse.json({ error: 'Invalid contact email format' }, { status: 400 })
    }

    // Check if ABN is already used by another company
    const existingCompany = await convex.query(api.companies.getByAbn, { abn: abnDigits })
    if (existingCompany && existingCompany._id !== user.company_id) {
      return NextResponse.json({ error: 'ABN is already registered to another company' }, { status: 400 })
    }

    // Update company
    await convex.mutation(api.companies.update, {
      id: user.company_id as Id<"companies">,
      name: name.trim(),
      abn: abnDigits,
      acn: acn ? acn.replace(/\s/g, '') : undefined,
      address: address || undefined,
      logoUrl: logo_url || undefined,
      primaryContactName: primary_contact_name || undefined,
      primaryContactEmail: primary_contact_email || undefined,
      primaryContactPhone: primary_contact_phone || undefined,
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.company_id as Id<"companies">,
      userId: user.id as Id<"users">,
      entityType: 'company',
      entityId: user.company_id,
      action: 'update',
      details: { fields_updated: Object.keys(body) },
    })

    // Get updated company
    const updatedCompany = await convex.query(api.companies.getById, {
      id: user.company_id as Id<"companies">,
    })

    return NextResponse.json({
      success: true,
      message: 'Company profile updated successfully',
      company: updatedCompany ? {
        id: updatedCompany._id,
        name: updatedCompany.name,
        abn: updatedCompany.abn,
        acn: updatedCompany.acn || null,
        address: updatedCompany.address || null,
        logo_url: updatedCompany.logoUrl || null,
        primary_contact_name: updatedCompany.primaryContactName || null,
        primary_contact_email: updatedCompany.primaryContactEmail || null,
        primary_contact_phone: updatedCompany.primaryContactPhone || null,
        forwarding_email: updatedCompany.forwardingEmail || null,
        settings: updatedCompany.settings || {},
        subscription_tier: updatedCompany.subscriptionTier || 'trial',
        subscription_status: updatedCompany.subscriptionStatus || 'active',
        created_at: new Date(updatedCompany._creationTime).toISOString(),
        updated_at: updatedCompany.updatedAt ? new Date(updatedCompany.updatedAt).toISOString() : null,
      } : null
    })
  } catch (error) {
    console.error('Update company error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
