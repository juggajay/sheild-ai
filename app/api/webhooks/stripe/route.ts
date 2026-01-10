import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { constructWebhookEvent, isStripeConfigured } from '@/lib/stripe'
import Stripe from 'stripe'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook handler for subscription lifecycle events
 *
 * Handles:
 * - checkout.session.completed: Initial subscription created
 * - customer.subscription.created: Subscription started
 * - customer.subscription.updated: Plan changed, trial ended, etc.
 * - customer.subscription.deleted: Subscription canceled
 * - invoice.paid: Successful payment
 * - invoice.payment_failed: Payment failed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    // In test mode without signature, allow for testing
    if (!isStripeConfigured()) {
      console.log('[Stripe Test Mode] Webhook received (not verified)')

      // Parse the test payload
      let event
      try {
        event = JSON.parse(body)
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
      }

      // Process in test mode
      await processStripeEvent(event, true)

      return NextResponse.json({ received: true, testMode: true })
    }

    // Production mode - verify signature
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = constructWebhookEvent(body, signature)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Process the event
    await processStripeEvent(event, false)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

/**
 * Process a Stripe event and update the database accordingly
 */
async function processStripeEvent(event: Stripe.Event, isTestMode: boolean) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const companyId = session.metadata?.companyId
      const tier = session.metadata?.tier

      if (companyId && tier) {
        // Update company subscription status
        await convex.mutation(api.companies.updateSubscriptionFromWebhook, {
          id: companyId as Id<"companies">,
          subscriptionTier: tier,
          subscriptionStatus: 'active',
          stripeSubscriptionId: session.subscription as string,
        })

        // Log billing event
        await convex.mutation(api.auditLogs.create, {
          companyId: companyId as Id<"companies">,
          entityType: 'billing',
          entityId: companyId,
          action: 'checkout_completed',
          details: {
            tier,
            subscription_id: session.subscription,
            customer_id: session.customer,
            stripe_event_id: event.id,
            test_mode: isTestMode,
          },
        })

        console.log(`[Stripe] Checkout completed for company ${companyId}, tier: ${tier}`)
      }
      break
    }

    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription
      const companyId = subscription.metadata?.companyId
      const tier = subscription.metadata?.tier

      if (companyId) {
        const status = subscription.status === 'trialing' ? 'trialing' : 'active'

        // Access period end safely
        const periodEnd = (subscription as { current_period_end?: number }).current_period_end

        await convex.mutation(api.companies.updateSubscriptionFromWebhook, {
          id: companyId as Id<"companies">,
          subscriptionTier: tier || 'professional',
          subscriptionStatus: status,
          stripeSubscriptionId: subscription.id,
          subscriptionPeriodEnd: periodEnd ? periodEnd * 1000 : undefined,
          trialEndsAt: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
        })

        // Log billing event
        await convex.mutation(api.auditLogs.create, {
          companyId: companyId as Id<"companies">,
          entityType: 'billing',
          entityId: companyId,
          action: 'subscription_created',
          details: {
            tier,
            status,
            subscription_id: subscription.id,
            trial_end: subscription.trial_end,
            stripe_event_id: event.id,
            test_mode: isTestMode,
          },
        })

        console.log(`[Stripe] Subscription created for company ${companyId}`)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const companyId = subscription.metadata?.companyId

      if (companyId) {
        // Map Stripe status to our status
        let status: string
        switch (subscription.status) {
          case 'active':
            status = 'active'
            break
          case 'trialing':
            status = 'trialing'
            break
          case 'past_due':
            status = 'past_due'
            break
          case 'canceled':
            status = 'canceled'
            break
          case 'unpaid':
            status = 'unpaid'
            break
          default:
            status = 'inactive'
        }

        // Get the tier from the subscription item's price
        let tier = subscription.metadata?.tier
        if (!tier && subscription.items?.data?.[0]?.price?.metadata?.tier) {
          tier = subscription.items.data[0].price.metadata.tier
        }

        // Access period end safely
        const periodEnd = (subscription as { current_period_end?: number }).current_period_end

        await convex.mutation(api.companies.updateSubscriptionFromWebhook, {
          id: companyId as Id<"companies">,
          subscriptionTier: tier,
          subscriptionStatus: status,
          subscriptionPeriodEnd: periodEnd ? periodEnd * 1000 : undefined,
          trialEndsAt: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
        })

        // Log billing event
        await convex.mutation(api.auditLogs.create, {
          companyId: companyId as Id<"companies">,
          entityType: 'billing',
          entityId: companyId,
          action: 'subscription_updated',
          details: {
            status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            stripe_event_id: event.id,
            test_mode: isTestMode,
          },
        })

        console.log(`[Stripe] Subscription updated for company ${companyId}, status: ${status}`)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const companyId = subscription.metadata?.companyId

      if (companyId) {
        // Downgrade to trial/free
        await convex.mutation(api.companies.updateSubscriptionFromWebhook, {
          id: companyId as Id<"companies">,
          subscriptionTier: 'trial',
          subscriptionStatus: 'canceled',
          clearSubscription: true,
        })

        // Log billing event
        await convex.mutation(api.auditLogs.create, {
          companyId: companyId as Id<"companies">,
          entityType: 'billing',
          entityId: companyId,
          action: 'subscription_deleted',
          details: {
            subscription_id: subscription.id,
            stripe_event_id: event.id,
            test_mode: isTestMode,
          },
        })

        console.log(`[Stripe] Subscription canceled for company ${companyId}`)
      }
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

      if (customerId) {
        // Find company by Stripe customer ID
        const company = await convex.query(api.companies.getByStripeCustomerId, {
          stripeCustomerId: customerId,
        })

        if (company) {
          // Ensure subscription is active if it was past_due or unpaid
          if (company.subscriptionStatus === 'past_due' || company.subscriptionStatus === 'unpaid') {
            await convex.mutation(api.companies.updateSubscriptionStatus, {
              id: company._id,
              subscriptionStatus: 'active',
            })
          }

          // Log billing event
          await convex.mutation(api.auditLogs.create, {
            companyId: company._id,
            entityType: 'billing',
            entityId: company._id as string,
            action: 'invoice_paid',
            details: {
              amount: invoice.amount_paid,
              currency: invoice.currency,
              invoice_id: invoice.id,
              stripe_event_id: event.id,
              test_mode: isTestMode,
            },
          })

          console.log(`[Stripe] Invoice paid for company ${company._id}`)
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

      if (customerId) {
        // Find company by Stripe customer ID
        const company = await convex.query(api.companies.getByStripeCustomerId, {
          stripeCustomerId: customerId,
        })

        if (company) {
          // Mark subscription as past due
          await convex.mutation(api.companies.updateSubscriptionStatus, {
            id: company._id,
            subscriptionStatus: 'past_due',
          })

          // Log billing event
          await convex.mutation(api.auditLogs.create, {
            companyId: company._id,
            entityType: 'billing',
            entityId: company._id as string,
            action: 'payment_failed',
            details: {
              amount: invoice.amount_due,
              currency: invoice.currency,
              invoice_id: invoice.id,
              attempt_count: invoice.attempt_count,
              stripe_event_id: event.id,
              test_mode: isTestMode,
            },
          })

          console.log(`[Stripe] Payment failed for company ${company._id}`)

          // TODO: Send email notification about failed payment
        }
      }
      break
    }

    default:
      console.log(`[Stripe] Unhandled event type: ${event.type}`)
  }
}
