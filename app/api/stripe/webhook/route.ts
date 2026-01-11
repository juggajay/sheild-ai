import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import Stripe from 'stripe'
import { constructWebhookEvent, isStripeConfigured, getStripe } from '@/lib/stripe'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * POST /api/stripe/webhook
 *
 * Handle Stripe webhook events for subscription lifecycle management.
 *
 * Key events handled:
 * - checkout.session.completed: Initial subscription creation
 * - customer.subscription.updated: Plan changes, cancellations
 * - customer.subscription.deleted: Subscription ended
 * - invoice.paid: Successful payment (resets billing period)
 * - invoice.payment_failed: Payment failure
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    console.error('Webhook: Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = constructWebhookEvent(body, signature)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`Stripe webhook received: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`Webhook handler error for ${event.type}:`, error)
    return NextResponse.json(
      { error: 'Webhook handler error' },
      { status: 500 }
    )
  }
}

/**
 * Handle successful checkout session completion
 * This is the initial subscription creation event
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const companyId = session.metadata?.companyId
  const tier = session.metadata?.tier
  const subscriptionId = session.subscription as string

  if (!companyId || !tier) {
    console.error('Checkout session missing metadata:', { companyId, tier })
    return
  }

  console.log(`Checkout completed for company ${companyId}, tier: ${tier}`)

  // Get subscription details to get period end
  let periodEnd: number | undefined
  let trialEndsAt: number | undefined

  if (isStripeConfigured() && subscriptionId) {
    try {
      const stripe = getStripe()
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      // In Stripe API v2024+, current_period_end is on subscription items
      const firstItem = subscription.items?.data?.[0]
      if (firstItem?.current_period_end) {
        periodEnd = firstItem.current_period_end * 1000
      }

      if (subscription.trial_end) {
        trialEndsAt = subscription.trial_end * 1000
      }
    } catch (err) {
      console.error('Failed to retrieve subscription details:', err)
    }
  }

  // Update company subscription
  await convex.mutation(api.companies.updateSubscriptionFromWebhook, {
    id: companyId as Id<"companies">,
    subscriptionTier: tier,
    subscriptionStatus: trialEndsAt ? 'trialing' : 'active',
    stripeSubscriptionId: subscriptionId,
    subscriptionPeriodEnd: periodEnd,
    trialEndsAt,
  })

  // Initialize billing period tracking
  await convex.mutation(api.companies.resetBillingPeriodVendorCount, {
    companyId: companyId as Id<"companies">,
    billingPeriodStart: Date.now(),
  })

  // Log the event
  await convex.mutation(api.auditLogs.create, {
    companyId: companyId as Id<"companies">,
    entityType: 'subscription',
    entityId: subscriptionId || companyId,
    action: 'subscription_created',
    details: {
      tier,
      stripe_subscription_id: subscriptionId,
      period_end: periodEnd,
      trial_ends_at: trialEndsAt,
    },
  })

  console.log(`Company ${companyId} subscription activated: ${tier}`)
}

/**
 * Handle subscription updates (plan changes, status changes)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const companyId = subscription.metadata?.companyId

  if (!companyId) {
    // Try to find company by customer ID
    const customerId = subscription.customer as string
    const company = await convex.query(api.companies.getByStripeCustomerId, {
      stripeCustomerId: customerId,
    })

    if (!company) {
      console.error('Could not find company for subscription update:', subscription.id)
      return
    }

    await updateCompanySubscription(company._id, subscription)
    return
  }

  await updateCompanySubscription(companyId as Id<"companies">, subscription)
}

async function updateCompanySubscription(
  companyId: Id<"companies">,
  subscription: Stripe.Subscription
) {
  const tier = subscription.metadata?.tier
  const status = mapStripeStatus(subscription.status)
  // In Stripe API v2024+, current_period_end is on subscription items
  const firstItem = subscription.items?.data?.[0]
  const periodEnd = firstItem?.current_period_end ? firstItem.current_period_end * 1000 : undefined
  const trialEnd = subscription.trial_end ? subscription.trial_end * 1000 : undefined

  await convex.mutation(api.companies.updateSubscriptionFromWebhook, {
    id: companyId,
    subscriptionTier: tier,
    subscriptionStatus: status,
    stripeSubscriptionId: subscription.id,
    subscriptionPeriodEnd: periodEnd,
    trialEndsAt: trialEnd,
  })

  // Log the event
  await convex.mutation(api.auditLogs.create, {
    companyId,
    entityType: 'subscription',
    entityId: subscription.id,
    action: 'subscription_updated',
    details: {
      status: subscription.status,
      tier,
      period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
  })

  console.log(`Subscription ${subscription.id} updated: status=${status}, tier=${tier}`)
}

/**
 * Handle subscription deletion (cancellation complete)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const company = await convex.query(api.companies.getByStripeCustomerId, {
    stripeCustomerId: customerId,
  })

  if (!company) {
    console.error('Could not find company for subscription deletion:', subscription.id)
    return
  }

  // Set subscription to cancelled and tier to trial (downgrade)
  await convex.mutation(api.companies.updateSubscriptionFromWebhook, {
    id: company._id,
    subscriptionTier: 'trial',
    subscriptionStatus: 'cancelled',
    clearSubscription: true,
  })

  // Log the event
  await convex.mutation(api.auditLogs.create, {
    companyId: company._id,
    entityType: 'subscription',
    entityId: subscription.id,
    action: 'subscription_cancelled',
    details: {
      previous_tier: subscription.metadata?.tier,
      ended_at: subscription.ended_at ? subscription.ended_at * 1000 : Date.now(),
    },
  })

  console.log(`Subscription ${subscription.id} cancelled for company ${company._id}`)
}

/**
 * Handle successful invoice payment
 * Resets billing period vendor count on subscription renewals
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // In Stripe API v2024+, subscription is in parent.subscription_details
  const subscriptionDetails = invoice.parent?.subscription_details
  const subscriptionId = typeof subscriptionDetails?.subscription === 'string'
    ? subscriptionDetails.subscription
    : subscriptionDetails?.subscription?.id

  if (!subscriptionId) {
    // One-time payment, not a subscription
    return
  }

  // Only reset on subscription renewals, not first payment
  if (invoice.billing_reason === 'subscription_cycle') {
    const result = await convex.mutation(api.companies.resetBillingPeriodBySubscriptionId, {
      stripeSubscriptionId: subscriptionId,
    })

    if (result.success) {
      console.log(`Reset vendor count for subscription ${subscriptionId}: ${result.resetTo} vendors`)

      // Log the event
      await convex.mutation(api.auditLogs.create, {
        companyId: result.companyId,
        entityType: 'billing',
        entityId: subscriptionId,
        action: 'billing_period_reset',
        details: {
          invoice_id: invoice.id,
          vendor_count_reset_to: result.resetTo,
          billing_period_start: result.billingPeriodStart,
        },
      })
    }
  }

  // Update subscription status to active if it was past_due
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return

  const company = await convex.query(api.companies.getByStripeCustomerId, {
    stripeCustomerId: customerId,
  })

  if (company && company.subscriptionStatus === 'past_due') {
    await convex.mutation(api.companies.updateSubscriptionStatus, {
      id: company._id,
      subscriptionStatus: 'active',
    })
    console.log(`Company ${company._id} subscription restored to active after payment`)
  }
}

/**
 * Handle failed invoice payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) {
    console.error('Could not determine customer for failed payment:', invoice.id)
    return
  }

  const company = await convex.query(api.companies.getByStripeCustomerId, {
    stripeCustomerId: customerId,
  })

  if (!company) {
    console.error('Could not find company for failed payment:', invoice.id)
    return
  }

  // Mark subscription as past_due
  await convex.mutation(api.companies.updateSubscriptionStatus, {
    id: company._id,
    subscriptionStatus: 'past_due',
  })

  // Log the event
  await convex.mutation(api.auditLogs.create, {
    companyId: company._id,
    entityType: 'billing',
    entityId: invoice.id,
    action: 'payment_failed',
    details: {
      amount_due: invoice.amount_due,
      attempt_count: invoice.attempt_count,
      next_attempt: invoice.next_payment_attempt,
    },
  })

  console.log(`Payment failed for company ${company._id}, invoice ${invoice.id}`)
}

/**
 * Map Stripe subscription status to our internal status
 */
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'unpaid':
      return 'cancelled'
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete'
    case 'paused':
      return 'paused'
    default:
      return 'unknown'
  }
}
