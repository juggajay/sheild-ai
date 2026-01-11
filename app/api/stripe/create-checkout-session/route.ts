import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import {
  createCheckoutSession,
  createOrGetCustomer,
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
 * Includes 14-day free trial for monthly subscriptions
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

    const companyId = company._id

    const body = await request.json()
    const { tier, billingInterval = 'monthly' } = body as {
      tier: string
      billingInterval?: 'monthly' | 'annual'
    }

    // Validate tier
    const validTiers = ['velocity', 'compliance', 'business', 'enterprise']
    if (!tier || !validTiers.includes(tier)) {
      return NextResponse.json(
        { error: `Invalid subscription tier. Must be one of: ${validTiers.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate billing interval
    if (!['monthly', 'annual'].includes(billingInterval)) {
      return NextResponse.json(
        { error: 'Invalid billing interval. Must be monthly or annual.' },
        { status: 400 }
      )
    }

    // Enterprise tier requires contact sales
    if (tier === 'enterprise') {
      return NextResponse.json(
        { error: 'Enterprise tier requires contacting sales. Please reach out to sales@risksure.ai' },
        { status: 400 }
      )
    }

    const subscriptionTier = tier as Exclude<SubscriptionTier, 'trial' | 'subcontractor'>

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      // Simulated mode - return a simulated success
      console.log('[Stripe Test Mode] Simulating checkout session creation')

      // Calculate trial end date (only for monthly)
      const trialEndsAt = billingInterval === 'monthly'
        ? Date.now() + TRIAL_CONFIG.durationDays * 24 * 60 * 60 * 1000
        : undefined

      // Update company with simulated subscription
      await convex.mutation(api.companies.updateSubscription, {
        id: companyId,
        subscriptionTier: subscriptionTier,
        subscriptionStatus: trialEndsAt ? 'trialing' : 'active',
        trialEndsAt,
      })

      // Log the action
      await convex.mutation(api.auditLogs.create, {
        companyId: companyId,
        userId: user._id,
        entityType: 'subscription',
        entityId: companyId,
        action: 'create_checkout',
        details: {
          tier: subscriptionTier,
          billingInterval,
          simulated: true,
          trial_days: billingInterval === 'monthly' ? TRIAL_CONFIG.durationDays : 0,
        },
      })

      return NextResponse.json({
        success: true,
        simulated: true,
        message: `${trialEndsAt ? 'Trial started' : 'Subscription activated'} for ${PRICING_PLANS[subscriptionTier].name} plan (Stripe test mode)`,
        redirectUrl: `${appUrl}/dashboard/settings/billing?success=true&tier=${subscriptionTier}&interval=${billingInterval}&simulated=true`,
      })
    }

    // Production mode - create actual Stripe checkout
    const settings = company.settings as Record<string, unknown> || {}
    const existingStripeCustomerId = settings.stripeCustomerId as string | undefined

    // Get or create Stripe customer
    const stripeCustomerId = await createOrGetCustomer({
      email: user.email,
      companyId: companyId,
      companyName: company.name,
    })

    // Update company with Stripe customer ID if not already set
    if (!existingStripeCustomerId) {
      await convex.mutation(api.companies.updateStripeCustomerId, {
        id: companyId,
        stripeCustomerId,
      })
    }

    // Create checkout session
    const session = await createCheckoutSession({
      customerId: stripeCustomerId,
      customerEmail: user.email,
      tier: subscriptionTier,
      billingInterval,
      companyId: companyId,
      successUrl: `${appUrl}/dashboard/settings/billing?success=true`,
      cancelUrl: `${appUrl}/dashboard/settings/billing?canceled=true`,
      trialDays: billingInterval === 'monthly' ? TRIAL_CONFIG.durationDays : 0,
    })

    // Log the action
    await convex.mutation(api.auditLogs.create, {
      companyId: companyId,
      userId: user._id,
      entityType: 'subscription',
      entityId: companyId,
      action: 'create_checkout',
      details: {
        tier: subscriptionTier,
        billingInterval,
        stripe_customer_id: stripeCustomerId,
        trial_days: billingInterval === 'monthly' ? TRIAL_CONFIG.durationDays : 0,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Checkout failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}
