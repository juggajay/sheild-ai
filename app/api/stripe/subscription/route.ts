import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import {
  PRICING_PLANS,
  SUBCONTRACTOR_PLAN,
  TRIAL_CONFIG,
  formatPrice,
  type SubscriptionTier,
} from '@/lib/stripe'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * GET /api/stripe/subscription
 *
 * Get current subscription status for the company
 */
export async function GET(request: NextRequest) {
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

    const { company: userCompany } = sessionData

    if (!userCompany) {
      return NextResponse.json(
        { error: 'No company associated with user' },
        { status: 404 }
      )
    }

    // Get subscription details from Convex
    const details = await convex.query(api.companies.getSubscriptionDetails, {
      companyId: userCompany._id,
    })

    if (!details) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const { company, vendorCount, billingEvents } = details

    // Determine subscription details
    const tier = (company.subscriptionTier || 'trial') as SubscriptionTier
    const status = company.subscriptionStatus || 'active'

    // Calculate trial days remaining
    let trialDaysRemaining = 0
    let isTrialing = false
    if (tier === 'trial' || status === 'trialing') {
      isTrialing = true
      if (company.trial_ends_at) {
        const trialEnd = new Date(company.trial_ends_at as number)
        const now = new Date()
        trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      } else {
        // Default trial period if no end date set
        trialDaysRemaining = TRIAL_CONFIG.durationDays
      }
    }

    // Get plan details
    let currentPlan
    if (tier === 'subcontractor') {
      currentPlan = { ...SUBCONTRACTOR_PLAN, priceMonthly: 0, priceAnnual: 0 }
    } else if (tier === 'trial') {
      currentPlan = {
        id: 'trial',
        name: 'Free Trial',
        description: 'Full access to Compliance features during trial',
        priceMonthly: 0,
        priceAnnual: 0,
        features: TRIAL_CONFIG.features,
        vendorLimit: TRIAL_CONFIG.vendorLimit,
      }
    } else if (tier in PRICING_PLANS) {
      currentPlan = PRICING_PLANS[tier as Exclude<SubscriptionTier, 'trial' | 'subcontractor'>]
    } else {
      currentPlan = {
        id: tier,
        name: 'Unknown Plan',
        description: '',
        priceMonthly: 0,
        priceAnnual: 0,
        features: [],
      }
    }

    // Calculate period end
    let periodEnd = null
    if (company.subscription_period_end) {
      periodEnd = new Date(company.subscription_period_end as number).toISOString()
    }

    return NextResponse.json({
      subscription: {
        tier,
        status,
        isTrialing,
        trialDaysRemaining,
        periodEnd,
        vendorCount,
        hasStripeCustomer: !!company.stripe_customer_id,
        hasActiveSubscription: !!company.stripe_subscription_id,
      },
      currentPlan: {
        ...currentPlan,
        priceMonthlyFormatted: formatPrice(currentPlan.priceMonthly || 0),
        priceAnnualFormatted: formatPrice(currentPlan.priceAnnual || 0),
      },
      availablePlans: Object.values(PRICING_PLANS).map(plan => ({
        ...plan,
        priceMonthlyFormatted: formatPrice(plan.priceMonthly),
        priceAnnualFormatted: formatPrice(plan.priceAnnual),
      })),
      billingEvents: billingEvents.map(event => ({
        ...event,
        details: JSON.parse(event.details || '{}'),
      })),
    })
  } catch (error) {
    console.error('Get subscription error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
