/**
 * Rate Limiting and Security Tests
 * Tests rate limiting behavior and security under load
 */

import { sleep, check, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import http from 'k6/http';
import { ENV, RATE_LIMITS } from '../config.js';
import { login } from '../helpers/auth.js';
import { randomEmail } from '../helpers/data.js';

// Custom metrics
const rateLimitHits = new Counter('rate_limit_hits');
const rateLimitBypass = new Counter('rate_limit_bypass');
const bruteForceBlocked = new Rate('brute_force_blocked');

// Test configuration
export const options = {
  scenarios: {
    // Test rate limiting on auth endpoints
    auth_rate_limit: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      exec: 'testAuthRateLimit',
      tags: { test: 'auth_rate_limit' },
    },
    // Test brute force protection
    brute_force: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 20,
      startTime: '2m30s',
      exec: 'testBruteForce',
      tags: { test: 'brute_force' },
    },
    // Test general API rate limiting
    api_rate_limit: {
      executor: 'constant-arrival-rate',
      rate: 200,  // 200 requests per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      startTime: '5m',
      exec: 'testApiRateLimit',
      tags: { test: 'api_rate_limit' },
    },
    // Test concurrent auth attempts
    concurrent_auth: {
      executor: 'shared-iterations',
      vus: 50,
      iterations: 200,
      startTime: '7m30s',
      exec: 'testConcurrentAuth',
      tags: { test: 'concurrent_auth' },
    },
  },
  thresholds: {
    'rate_limit_hits': ['count>0'],  // We should hit rate limits
    'rate_limit_bypass': ['count==0'],  // Should not bypass rate limits
    'brute_force_blocked': ['rate>0.8'],  // 80%+ brute force attempts blocked
  },
};

/**
 * Test auth endpoint rate limiting
 * Verify that login attempts are rate limited
 */
export function testAuthRateLimit() {
  group('Auth Rate Limiting', () => {
    const url = `${ENV.API_URL}/auth/login`;
    const payload = JSON.stringify({
      email: 'rate_limit_test@test.com',
      password: 'WrongPassword123!',
    });

    const params = {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'auth', endpoint: 'login' },
    };

    // Rapid fire login attempts
    const responses = [];
    for (let i = 0; i < 10; i++) {
      const res = http.post(url, payload, params);
      responses.push(res.status);

      // Track rate limit responses (429)
      if (res.status === 429) {
        rateLimitHits.add(1);
      }

      // Very short sleep to stress test
      sleep(0.05);
    }

    // Check if rate limiting kicked in
    const rateLimited = responses.some(s => s === 429);
    check(rateLimited, {
      'rate limiting active on auth': (r) => r === true,
    });

    // If we didn't get rate limited after 10 rapid attempts, that's a bypass
    if (!rateLimited) {
      rateLimitBypass.add(1);
    }
  });

  // Wait before next iteration to reset rate limit window
  sleep(10);
}

/**
 * Test brute force protection
 * Attempt many failed logins to verify account protection
 */
export function testBruteForce() {
  group('Brute Force Protection', () => {
    const targetEmail = `brute_force_target_${__VU}@test.com`;
    const url = `${ENV.API_URL}/auth/login`;

    // Attempt many failed logins
    let blocked = false;
    let attempts = 0;

    for (let i = 0; i < 15; i++) {
      const payload = JSON.stringify({
        email: targetEmail,
        password: `WrongPassword${i}!`,
      });

      const res = http.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'auth', endpoint: 'brute_force' },
      });

      attempts++;

      // Check for blocking responses
      if (res.status === 429 || res.status === 423 || res.status === 403) {
        blocked = true;
        rateLimitHits.add(1);
        break;
      }

      sleep(0.1);
    }

    bruteForceBlocked.add(blocked);

    check(blocked, {
      'brute force attempts blocked': (b) => b === true,
    });

    if (!blocked) {
      console.warn(`Brute force not blocked after ${attempts} attempts for ${targetEmail}`);
    }
  });

  sleep(5);
}

/**
 * Test general API rate limiting
 * High volume requests to API endpoints
 */
export function testApiRateLimit() {
  // Login once
  const authData = login();
  if (!authData) {
    return;
  }

  group('API Rate Limiting', () => {
    const endpoints = [
      '/projects',
      '/subcontractors',
      '/documents',
      '/notifications',
    ];

    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const url = `${ENV.API_URL}${endpoint}`;

    const res = http.get(url, {
      headers: authData.headers,
      cookies: authData.cookies,
      tags: { type: 'api', endpoint: endpoint.replace('/', '') },
    });

    // Track rate limiting
    if (res.status === 429) {
      rateLimitHits.add(1);
    }

    check(res, {
      'request processed or rate limited': (r) => r.status === 200 || r.status === 429,
    });
  });
}

/**
 * Test concurrent authentication
 * Many users logging in at the same time
 */
export function testConcurrentAuth() {
  group('Concurrent Auth', () => {
    const email = randomEmail('concurrent');
    const url = `${ENV.API_URL}/auth/login`;

    // Try to login (will fail - user doesn't exist, but tests load)
    const payload = JSON.stringify({
      email: email,
      password: 'TestPassword123!',
    });

    const res = http.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'auth', endpoint: 'concurrent_login' },
    });

    // We expect 401 (invalid credentials) or 429 (rate limited)
    check(res, {
      'auth handled under load': (r) => r.status === 401 || r.status === 429 || r.status === 400,
    });

    if (res.status === 429) {
      rateLimitHits.add(1);
    }
  });

  sleep(0.1);
}

/**
 * Test password reset rate limiting
 */
export function testPasswordResetRateLimit() {
  group('Password Reset Rate Limiting', () => {
    const url = `${ENV.API_URL}/auth/forgot-password`;
    const targetEmail = 'rate_limit_reset@test.com';

    // Rapid password reset requests
    for (let i = 0; i < 10; i++) {
      const res = http.post(url, JSON.stringify({ email: targetEmail }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'auth', endpoint: 'password_reset' },
      });

      if (res.status === 429) {
        rateLimitHits.add(1);
        break;
      }

      sleep(0.05);
    }
  });

  sleep(5);
}

/**
 * Test magic link rate limiting
 */
export function testMagicLinkRateLimit() {
  group('Magic Link Rate Limiting', () => {
    const url = `${ENV.API_URL}/portal/auth/magic-link`;
    const targetEmail = 'magic_link_test@test.com';

    // Rapid magic link requests
    for (let i = 0; i < 10; i++) {
      const res = http.post(url, JSON.stringify({ email: targetEmail }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'auth', endpoint: 'magic_link' },
      });

      if (res.status === 429) {
        rateLimitHits.add(1);
        break;
      }

      sleep(0.05);
    }
  });

  sleep(5);
}

/**
 * Test IP-based rate limiting
 * All requests from same VU (same "IP") should eventually be limited
 */
export function testIpRateLimit() {
  group('IP-based Rate Limiting', () => {
    const url = `${ENV.API_URL}/auth/login`;

    // Make many requests rapidly
    let hitLimit = false;
    for (let i = 0; i < 100; i++) {
      const res = http.post(url, JSON.stringify({
        email: `ip_test_${i}@test.com`,
        password: 'TestPassword123!',
      }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'auth', endpoint: 'ip_rate_limit' },
      });

      if (res.status === 429) {
        hitLimit = true;
        rateLimitHits.add(1);
        console.log(`IP rate limit hit after ${i + 1} requests`);
        break;
      }

      // No sleep - max speed
    }

    check(hitLimit, {
      'IP-based rate limiting works': (h) => h === true,
    });
  });

  sleep(60);  // Wait for rate limit window to reset
}

// Setup function
export function setup() {
  console.log('Rate Limiting and Security tests starting...');
  console.log(`Target: ${ENV.BASE_URL}`);
  console.log(`Expected auth rate limit: ${RATE_LIMITS.auth.requests} per ${RATE_LIMITS.auth.window}s`);

  return { startTime: Date.now() };
}

// Teardown function
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`Rate Limiting tests completed in ${duration}ms`);
}

// Summary handler
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    rate_limit_hits: data.metrics.rate_limit_hits?.values?.count || 0,
    rate_limit_bypass: data.metrics.rate_limit_bypass?.values?.count || 0,
    brute_force_blocked_rate: data.metrics.brute_force_blocked?.values?.rate || 0,
    total_requests: data.metrics.http_reqs?.values?.count || 0,
    failed_requests: data.metrics.http_req_failed?.values?.rate || 0,
  };

  return {
    'rate-limiting-summary.json': JSON.stringify(summary, null, 2),
  };
}
