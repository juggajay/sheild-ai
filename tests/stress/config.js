/**
 * k6 Stress Test Configuration
 * RiskShield AI - Comprehensive Load Testing Suite
 */

// Environment configuration
export const ENV = {
  BASE_URL: __ENV.BASE_URL || 'http://localhost:3000',
  API_URL: __ENV.API_URL || 'http://localhost:3000/api',

  // Test user credentials (create these in your dev environment)
  ADMIN_EMAIL: __ENV.ADMIN_EMAIL || 'admin@test.com',
  ADMIN_PASSWORD: __ENV.ADMIN_PASSWORD || 'TestPassword123!',

  USER_EMAIL: __ENV.USER_EMAIL || 'user@test.com',
  USER_PASSWORD: __ENV.USER_PASSWORD || 'TestPassword123!',

  // Stripe test webhook secret (for webhook tests)
  STRIPE_WEBHOOK_SECRET: __ENV.STRIPE_WEBHOOK_SECRET || 'whsec_test',
};

// Load test stages - customize based on your infrastructure
export const LOAD_STAGES = {
  // Smoke test - verify system works
  smoke: {
    stages: [
      { duration: '1m', target: 5 },
      { duration: '1m', target: 5 },
      { duration: '1m', target: 0 },
    ],
  },

  // Load test - normal expected load
  load: {
    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 0 },
    ],
  },

  // Stress test - find breaking points
  stress: {
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '5m', target: 300 },
      { duration: '2m', target: 400 },
      { duration: '5m', target: 400 },
      { duration: '10m', target: 0 },
    ],
  },

  // Spike test - sudden traffic surge
  spike: {
    stages: [
      { duration: '1m', target: 50 },
      { duration: '30s', target: 500 },
      { duration: '1m', target: 500 },
      { duration: '30s', target: 50 },
      { duration: '2m', target: 50 },
      { duration: '1m', target: 0 },
    ],
  },

  // Soak test - extended duration
  soak: {
    stages: [
      { duration: '5m', target: 100 },
      { duration: '4h', target: 100 },
      { duration: '5m', target: 0 },
    ],
  },

  // Breakpoint test - find the limit
  breakpoint: {
    stages: [
      { duration: '2m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '2m', target: 400 },
      { duration: '2m', target: 500 },
      { duration: '2m', target: 600 },
      { duration: '2m', target: 700 },
      { duration: '2m', target: 800 },
      { duration: '2m', target: 900 },
      { duration: '2m', target: 1000 },
    ],
  },
};

// Performance thresholds - tests fail if these are exceeded
export const THRESHOLDS = {
  // HTTP request thresholds
  http_req_duration: ['p(95)<500', 'p(99)<1500'],  // 95% under 500ms, 99% under 1.5s
  http_req_failed: ['rate<0.05'],                   // Less than 5% errors (relaxed for testing)
};

// Extended thresholds for specific test types
export const EXTENDED_THRESHOLDS = {
  // API-specific thresholds
  'http_req_duration{type:api}': ['p(95)<300'],     // API calls under 300ms
  'http_req_duration{type:auth}': ['p(95)<500'],    // Auth under 500ms
  'http_req_duration{type:upload}': ['p(95)<5000'], // Uploads under 5s
  'http_req_duration{type:webhook}': ['p(95)<200'], // Webhooks under 200ms

  // Custom metrics thresholds (only use in tests that define these metrics)
  'login_success': ['rate>0.95'],                   // 95% login success
  'upload_success': ['rate>0.90'],                  // 90% upload success
  'journey_complete': ['rate>0.85'],                // 85% journey completion
};

// Rate limiting configuration (matches your app's limits)
export const RATE_LIMITS = {
  auth: {
    requests: 5,
    window: 60,  // 5 requests per minute
  },
  general: {
    requests: 100,
    window: 60,  // 100 requests per minute
  },
};

// Test data configuration
export const TEST_DATA = {
  // Number of test entities to create
  projects: 10,
  subcontractors: 100,
  documents: 50,

  // Sample ABNs for testing
  sampleABNs: [
    '51824753556',
    '33102417032',
    '51002046384',
    '80004552064',
    '34132104560',
  ],

  // Australian states for testing
  states: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'],

  // Insurance types
  insuranceTypes: [
    'public_liability',
    'professional_indemnity',
    'workers_compensation',
    'contract_works',
    'motor_vehicle',
  ],
};

// Concurrent user scenarios
export const SCENARIOS = {
  // Mixed workload - simulates real usage patterns
  mixed_workload: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: LOAD_STAGES.load.stages,
    gracefulRampDown: '30s',
  },

  // Constant arrival rate - for throughput testing
  constant_arrival: {
    executor: 'constant-arrival-rate',
    rate: 100,
    timeUnit: '1s',
    duration: '5m',
    preAllocatedVUs: 50,
    maxVUs: 200,
  },

  // Per-VU iterations - for specific journey testing
  per_vu_iterations: {
    executor: 'per-vu-iterations',
    vus: 50,
    iterations: 10,
    maxDuration: '10m',
  },
};
