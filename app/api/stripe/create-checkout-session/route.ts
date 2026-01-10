import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from '@/lib/auth'
import {
  createCheckoutSession,
  createOrGetCustomer,
  getStripePriceId,
  PRICING_PLANS,
  isStripeConfigured,
  TRIAL_CONFIG,
  type SubscriptionTier,
} from '@/lib/stripe'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * POST /api/stripe/create-checkout-session
 *
 * Create a Stripe Checkout Session for subscription signup
 * Includes 14-day free trial
 */
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

    // Only admin can manage billing
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can manage billing' },
        { status: 403 }
      )
    }

    if (!user.company_id) {
      return NextResponse.json(
        { error: 'No company associated with user' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { tier } = body as { tier: string }

    // Validate tier
    if (!tier || !['starter', 'professional', 'enterprise'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid subscription tier. Must be starter, professional, or enterprise.' },
        { status: 400 }
      )
    }

    const subscriptionTier = tier as Exclude<SubscriptionTier, 'trial' | 'subcontractor'>

    // Get company from Convex
    const company = await convex.query(api.companies.getById, {
      id: user.company_id as Id<"companies">,
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const priceId = getStripePriceId(subscriptionTier)

    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      // Simulated mode - return a simulated success
      console.log('[Stripe Test Mode] Simulating checkout session creation')

      // Calculate trial end date
      const trialEndsAt = Date.now() + TRIAL_CONFIG.durationDays * 24 * 60 * 60 * 1000

      // Update company with simulated subscription
      await convex.mutation(api.companies.updateSubscription, {
        id: user.company_id as Id<"companies">,
        subscriptionTier: subscriptionTier,
        subscriptionStatus: 'trialing',
        trialEndsAt,
      })

      // Log the action
      await convex.mutation(api.auditLogs.create, {
        companyId: user.company_id as Id<"companies">,
        userId: user.id as Id<"users">,
        entityType: 'subscription',
        entityId: user.company_id,
        action: 'create_checkout',
        details: {
          tier: subscriptionTier,
          simulated: true,
          trial_days: TRIAL_CONFIG.durationDays,
        },
      })

      return NextResponse.json({
        success: true,
        simulated: true,
        message: `Trial started for ${PRICING_PLANS[subscriptionTier].name} plan (Stripe test mode)`,
        redirectUrl: `${appUrl}/dashboard/settings/billing?success=true&tier=${subscriptionTier}&simulated=true`,
      })
    }

    // Production mode - create actual Stripe checkout
    const settings = company.settings as Record<string, unknown> || {}
    const existingStripeCustomerId = settings.stripeCustomerId as string | undefined

    // Get or create Stripe customer
    const stripeCustomerId = await createOrGetCustomer({
      email: user.email,
      companyId: user.company_id,
      companyName: company.name,
    })

    // Update company with Stripe customer ID if not already set
    if (!existingStripeCustomerId) {
      await convex.mutation(api.companies.updateStripeCustomerId, {
        id: user.company_id as Id<"companies">,
        stripeCustomerId,
      })
    }

    // Create checkout session
    const session = await createCheckoutSession({
      customerId: stripeCustomerId,
      customerEmail: user.email,
      priceId,
      tier: subscriptionTier,
      companyId: user.company_id,
      successUrl: `${appUrl}/dashboard/settings/billing?success=true`,
      cancelUrl: `${appUrl}/dashboard/settings/billing?canceled=true`,
      trialDays: TRIAL_CONFIG.durationDays,
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.company_id as Id<"companies">,
      userId: user.id as Id<"users">,
      entityType: 'subscription',
      entityId: user.company_id,
      action: 'create_checkout',
      details: {
        tier: subscriptionTier,
        stripe_customer_id: stripeCustomerId,
        trial_days: TRIAL_CONFIG.durationDays,
      },
    })

    const sessionUrl = 'url' in session ? session.url : null

    if (!sessionUrl) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: sessionUrl,
    })
  } catch (error) {
    console.error('Create checkout session error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
