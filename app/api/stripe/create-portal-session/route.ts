import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { createPortalSession, isStripeConfigured } from '@/lib/stripe'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * POST /api/stripe/create-portal-session
 *
 * Create a Stripe Customer Portal session for subscription management
 * Allows customers to:
 * - Update payment method
 * - Cancel subscription
 * - View invoices
 * - Change plan (if configured)
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user from Convex
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { user, company } = sessionData

    // Only admin can manage billing
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can manage billing' },
        { status: 403 }
      )
    }

    if (!company) {
      return NextResponse.json(
        { error: 'No company associated with user' },
        { status: 404 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const returnUrl = `${appUrl}/dashboard/settings/billing`

    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      // Simulated mode
      console.log('[Stripe Test Mode] Simulating portal session creation')

      return NextResponse.json({
        success: true,
        simulated: true,
        message: 'Stripe Customer Portal not available in test mode',
        portalUrl: returnUrl,
      })
    }

    // Production mode - create actual portal session
    const settings = company.settings as Record<string, unknown> || {}
    const stripeCustomerId = settings.stripeCustomerId as string | undefined

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe to a plan first.' },
        { status: 400 }
      )
    }

    const session = await createPortalSession({
      customerId: stripeCustomerId,
      returnUrl,
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: company._id,
      userId: user._id,
      entityType: 'subscription',
      entityId: company._id.toString(),
      action: 'access_portal',
      details: {
        stripe_customer_id: stripeCustomerId,
      },
    })

    const portalUrl = 'url' in session ? session.url : null

    if (!portalUrl) {
      return NextResponse.json(
        { error: 'Failed to create portal session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      portalUrl,
    })
  } catch (error) {
    console.error('Create portal session error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
