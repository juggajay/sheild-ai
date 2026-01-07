import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import crypto from 'crypto'

// SendGrid webhook event types
type SendGridEventType =
  | 'processed'
  | 'dropped'
  | 'deferred'
  | 'delivered'
  | 'bounce'
  | 'open'
  | 'click'
  | 'spamreport'
  | 'unsubscribe'
  | 'group_unsubscribe'
  | 'group_resubscribe'

interface SendGridEvent {
  email: string
  timestamp: number
  'smtp-id'?: string
  event: SendGridEventType
  category?: string[]
  sg_event_id: string
  sg_message_id: string
  response?: string
  attempt?: string
  useragent?: string
  ip?: string
  url?: string
  reason?: string
  status?: string
  type?: string
  bounce_classification?: string
}

/**
 * Verify SendGrid webhook signature
 * https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  publicKey: string
): boolean {
  try {
    const timestampedPayload = timestamp + payload
    const decodedSignature = Buffer.from(signature, 'base64')

    const verifier = crypto.createVerify('sha256')
    verifier.update(timestampedPayload)

    return verifier.verify(publicKey, decodedSignature)
  } catch (error) {
    console.error('[SendGrid Webhook] Signature verification failed:', error)
    return false
  }
}

/**
 * Map SendGrid event to communication status
 */
function mapEventToStatus(event: SendGridEventType): string | null {
  switch (event) {
    case 'delivered':
      return 'delivered'
    case 'open':
      return 'opened'
    case 'bounce':
    case 'dropped':
      return 'failed'
    // These events don't change our tracked status
    case 'processed':
    case 'deferred':
    case 'click':
    case 'spamreport':
    case 'unsubscribe':
    case 'group_unsubscribe':
    case 'group_resubscribe':
    default:
      return null
  }
}

/**
 * POST /api/webhooks/sendgrid - Receive SendGrid event webhooks
 *
 * This endpoint receives delivery, open, and click events from SendGrid
 * to track the status of sent emails.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    // Verify webhook signature if configured
    const webhookKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY
    if (webhookKey) {
      const signature = request.headers.get('x-twilio-email-event-webhook-signature')
      const timestamp = request.headers.get('x-twilio-email-event-webhook-timestamp')

      if (!signature || !timestamp) {
        console.warn('[SendGrid Webhook] Missing signature headers')
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }

      if (!verifyWebhookSignature(body, signature, timestamp, webhookKey)) {
        console.warn('[SendGrid Webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Parse the webhook payload
    let events: SendGridEvent[]
    try {
      events = JSON.parse(body)
    } catch {
      console.error('[SendGrid Webhook] Invalid JSON payload')
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Ensure events is an array
    if (!Array.isArray(events)) {
      events = [events]
    }

    const db = getDb()
    const now = new Date().toISOString()

    let processed = 0
    let updated = 0

    for (const event of events) {
      processed++

      const { email, event: eventType, sg_message_id, timestamp, reason, bounce_classification } = event

      console.log('[SendGrid Webhook] Processing event:', {
        email,
        eventType,
        messageId: sg_message_id
      })

      // Map the event to our status
      const newStatus = mapEventToStatus(eventType)
      if (!newStatus) {
        // Event type doesn't require a status update
        continue
      }

      // Find communications by recipient email that are in a state that can transition
      // We look for recent emails (last 7 days) to this recipient
      const communications = db.prepare(`
        SELECT id, status, sent_at
        FROM communications
        WHERE recipient_email = ?
          AND status IN ('pending', 'sent', 'delivered')
          AND sent_at > datetime('now', '-7 days')
        ORDER BY sent_at DESC
        LIMIT 5
      `).all(email) as Array<{
        id: string
        status: string
        sent_at: string
      }>

      if (communications.length === 0) {
        console.log('[SendGrid Webhook] No matching communication found for:', email)
        continue
      }

      // Update the most recent matching communication
      const communication = communications[0]

      // Only update if the new status is "higher" than current
      // pending < sent < delivered < opened
      // failed can come from any state
      const statusPriority: Record<string, number> = {
        'pending': 0,
        'sent': 1,
        'delivered': 2,
        'opened': 3,
        'failed': -1 // Special case
      }

      const currentPriority = statusPriority[communication.status] ?? 0
      const newPriority = statusPriority[newStatus] ?? 0

      // Update if new status is higher priority or if it's a failure
      if (newStatus === 'failed' || newPriority > currentPriority) {
        const updateFields: string[] = ['status = ?', 'updated_at = ?']
        const updateValues: (string | null)[] = [newStatus, now]

        // Add timestamp for specific events
        if (newStatus === 'delivered') {
          updateFields.push('delivered_at = ?')
          updateValues.push(new Date(timestamp * 1000).toISOString())
        } else if (newStatus === 'opened') {
          updateFields.push('opened_at = ?')
          updateValues.push(new Date(timestamp * 1000).toISOString())
        }

        updateValues.push(communication.id)

        db.prepare(`
          UPDATE communications
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `).run(...updateValues)

        updated++

        console.log('[SendGrid Webhook] Updated communication:', {
          id: communication.id,
          previousStatus: communication.status,
          newStatus,
          reason: reason || bounce_classification
        })

        // If it's a bounce or failure, log additional details
        if (newStatus === 'failed' && (reason || bounce_classification)) {
          console.warn('[SendGrid Webhook] Email delivery failed:', {
            email,
            reason,
            bounce_classification,
            communicationId: communication.id
          })
        }
      }
    }

    console.log('[SendGrid Webhook] Batch complete:', { processed, updated })

    return NextResponse.json({
      success: true,
      processed,
      updated
    })

  } catch (error) {
    console.error('[SendGrid Webhook] Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/sendgrid - Health check for webhook endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'SendGrid webhook endpoint is active',
    configured: !!process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY
  })
}
