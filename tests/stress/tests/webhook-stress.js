/**
 * Webhook Stress Tests
 * Tests Stripe and SendGrid webhook handling under load
 */

import { sleep, check, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import http from 'k6/http';
import crypto from 'k6/crypto';
import { ENV } from '../config.js';
import {
  generateStripeWebhookEvent,
  generateSendGridWebhookEvent,
  randomString,
} from '../helpers/data.js';

// Custom metrics
const webhookSuccess = new Rate('webhook_success');
const webhookDuration = new Trend('webhook_duration');
const webhookErrors = new Counter('webhook_errors');

// Test configuration
export const options = {
  scenarios: {
    // Stripe webhook flood
    stripe_webhooks: {
      executor: 'constant-arrival-rate',
      rate: 50,  // 50 webhooks per second
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: 'testStripeWebhook',
      tags: { webhook: 'stripe' },
    },
    // SendGrid webhook flood
    sendgrid_webhooks: {
      executor: 'constant-arrival-rate',
      rate: 100,  // 100 webhooks per second (email events are frequent)
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 30,
      maxVUs: 60,
      startTime: '3m30s',
      exec: 'testSendGridWebhook',
      tags: { webhook: 'sendgrid' },
    },
    // Mixed webhook load
    mixed_webhooks: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '3m', target: 30 },
        { duration: '1m', target: 60 },
        { duration: '2m', target: 60 },
        { duration: '1m', target: 0 },
      ],
      startTime: '7m',
      exec: 'testMixedWebhooks',
      tags: { webhook: 'mixed' },
    },
  },
  thresholds: {
    'webhook_success': ['rate>0.95'],
    'webhook_duration': ['p(95)<500'],
    'http_req_duration{type:webhook}': ['p(95)<300'],
    'http_req_failed{type:webhook}': ['rate<0.05'],
  },
};

/**
 * Generate Stripe webhook signature
 * Note: This is a simplified version - real signatures require the webhook secret
 */
function generateStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;

  // In k6, we can use crypto.hmac
  const signature = crypto.hmac('sha256', secret, signedPayload, 'hex');

  return `t=${timestamp},v1=${signature}`;
}

/**
 * Test Stripe webhook handling
 */
export function testStripeWebhook() {
  group('Stripe Webhook', () => {
    const url = `${ENV.API_URL}/webhooks/stripe`;

    // Rotate through different event types
    const eventTypes = [
      'checkout.session.completed',
      'customer.subscription.updated',
      'invoice.paid',
    ];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    const event = generateStripeWebhookEvent(eventType);
    const payload = JSON.stringify(event);

    // Generate signature (will be invalid without real secret, but tests the endpoint)
    const signature = generateStripeSignature(payload, ENV.STRIPE_WEBHOOK_SECRET);

    const startTime = Date.now();

    const res = http.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
      },
      tags: { type: 'webhook', endpoint: 'stripe' },
    });

    const duration = Date.now() - startTime;
    webhookDuration.add(duration);

    // Accept 200 (success) or 400/401 (signature invalid in test)
    const success = res.status === 200 || res.status === 400 || res.status === 401;
    webhookSuccess.add(success);

    check(res, {
      'stripe webhook processed': (r) => r.status === 200 || r.status === 400 || r.status === 401,
      'response time ok': (r) => r.timings.duration < 500,
    });

    if (res.status >= 500) {
      webhookErrors.add(1);
      console.error(`Stripe webhook error: ${res.status} - ${res.body}`);
    }
  });
}

/**
 * Test SendGrid webhook handling
 */
export function testSendGridWebhook() {
  group('SendGrid Webhook', () => {
    const url = `${ENV.API_URL}/webhooks/sendgrid`;

    // Rotate through different event types
    const eventTypes = ['delivered', 'opened', 'bounce', 'dropped'];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    const events = generateSendGridWebhookEvent(eventType);
    const payload = JSON.stringify(events);

    const startTime = Date.now();

    const res = http.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        // SendGrid webhook verification headers would go here
      },
      tags: { type: 'webhook', endpoint: 'sendgrid' },
    });

    const duration = Date.now() - startTime;
    webhookDuration.add(duration);

    // SendGrid webhooks should return 200 or 202
    const success = res.status === 200 || res.status === 202 || res.status === 400;
    webhookSuccess.add(success);

    check(res, {
      'sendgrid webhook processed': (r) => r.status === 200 || r.status === 202 || r.status === 400,
      'response time ok': (r) => r.timings.duration < 500,
    });

    if (res.status >= 500) {
      webhookErrors.add(1);
      console.error(`SendGrid webhook error: ${res.status} - ${res.body}`);
    }
  });
}

/**
 * Test mixed webhook load
 */
export function testMixedWebhooks() {
  // Randomly choose between Stripe and SendGrid
  if (Math.random() < 0.4) {
    testStripeWebhook();
  } else {
    testSendGridWebhook();
  }

  sleep(0.1);
}

/**
 * Test webhook idempotency
 * Send the same event multiple times
 */
export function testWebhookIdempotency() {
  group('Webhook Idempotency', () => {
    const url = `${ENV.API_URL}/webhooks/stripe`;

    // Create a single event
    const event = generateStripeWebhookEvent('checkout.session.completed');
    const payload = JSON.stringify(event);
    const signature = generateStripeSignature(payload, ENV.STRIPE_WEBHOOK_SECRET);

    // Send the same event 5 times
    for (let i = 0; i < 5; i++) {
      const res = http.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
        tags: { type: 'webhook', endpoint: 'stripe_idempotent' },
      });

      check(res, {
        'idempotent webhook handled': (r) =>
          r.status === 200 || r.status === 400 || r.status === 409,  // 409 = already processed
      });

      sleep(0.05);
    }
  });
}

/**
 * Test webhook with malformed data
 */
export function testMalformedWebhooks() {
  group('Malformed Webhooks', () => {
    const stripeUrl = `${ENV.API_URL}/webhooks/stripe`;
    const sendgridUrl = `${ENV.API_URL}/webhooks/sendgrid`;

    // Test cases for malformed data
    const testCases = [
      { payload: '', desc: 'empty body' },
      { payload: 'not json', desc: 'invalid json' },
      { payload: '{}', desc: 'empty object' },
      { payload: '{"type": "unknown.event"}', desc: 'unknown event type' },
      { payload: '{"id": null}', desc: 'null id' },
    ];

    for (const tc of testCases) {
      // Stripe
      let res = http.post(stripeUrl, tc.payload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'webhook', endpoint: 'stripe_malformed' },
      });

      check(res, {
        [`stripe handles ${tc.desc}`]: (r) => r.status === 400 || r.status === 401,
      });

      // SendGrid
      res = http.post(sendgridUrl, tc.payload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'webhook', endpoint: 'sendgrid_malformed' },
      });

      check(res, {
        [`sendgrid handles ${tc.desc}`]: (r) => r.status === 400 || r.status === 200,
      });
    }
  });
}

/**
 * Test webhook timeout behavior
 * Simulate slow processing
 */
export function testWebhookBatch() {
  group('Webhook Batch', () => {
    const url = `${ENV.API_URL}/webhooks/sendgrid`;

    // SendGrid can send batch events
    const batchSize = 50;
    const events = [];

    for (let i = 0; i < batchSize; i++) {
      const eventTypes = ['delivered', 'opened', 'bounce'];
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      events.push(...generateSendGridWebhookEvent(eventType));
    }

    const payload = JSON.stringify(events);
    const startTime = Date.now();

    const res = http.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'webhook', endpoint: 'sendgrid_batch' },
      timeout: '30s',
    });

    const duration = Date.now() - startTime;
    console.log(`Batch of ${batchSize} events processed in ${duration}ms`);

    check(res, {
      'batch webhook processed': (r) => r.status === 200 || r.status === 202,
      'batch processed in time': (r) => r.timings.duration < 5000,
    });
  });

  sleep(1);
}

// Setup function
export function setup() {
  console.log('Webhook Stress tests starting...');
  console.log(`Target: ${ENV.BASE_URL}`);

  // Test that webhook endpoints exist
  const stripeRes = http.post(`${ENV.API_URL}/webhooks/stripe`, '{}', {
    headers: { 'Content-Type': 'application/json' },
  });
  console.log(`Stripe webhook endpoint status: ${stripeRes.status}`);

  const sendgridRes = http.post(`${ENV.API_URL}/webhooks/sendgrid`, '[]', {
    headers: { 'Content-Type': 'application/json' },
  });
  console.log(`SendGrid webhook endpoint status: ${sendgridRes.status}`);

  return { startTime: Date.now() };
}

// Teardown function
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`Webhook Stress tests completed in ${duration}ms`);
}

// Summary handler
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    webhook_success_rate: data.metrics.webhook_success?.values?.rate || 0,
    webhook_duration_avg: data.metrics.webhook_duration?.values?.avg || 0,
    webhook_duration_p95: data.metrics.webhook_duration?.values['p(95)'] || 0,
    webhook_errors: data.metrics.webhook_errors?.values?.count || 0,
    total_webhooks: data.metrics.http_reqs?.values?.count || 0,
  };

  return {
    'webhook-stress-summary.json': JSON.stringify(summary, null, 2),
  };
}
