/**
 * Stress Test Scenarios
 * Tests system behavior under various extreme conditions
 */

import { sleep, check, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import http from 'k6/http';
import { SharedArray } from 'k6/data';
import { ENV, LOAD_STAGES, THRESHOLDS, SCENARIOS } from '../config.js';
import { login, logout } from '../helpers/auth.js';
import {
  projectsApi,
  subcontractorsApi,
  documentsApi,
  dashboardApi,
  parseResponse,
  apiUpload,
} from '../helpers/api.js';
import {
  generateProject,
  generateSubcontractor,
  generateBulkImportCSV,
  generateFakePDF,
} from '../helpers/data.js';

// Custom metrics
const stressErrors = new Counter('stress_errors');
const recoveryTime = new Trend('recovery_time');
const throughput = new Counter('throughput');

// Scenario to run (passed via environment variable)
const SCENARIO = __ENV.SCENARIO || 'spike';

// Test configurations for different scenarios
const scenarioConfigs = {
  // Spike test - sudden traffic surge
  spike: {
    scenarios: {
      spike_test: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: LOAD_STAGES.spike.stages,
        gracefulRampDown: '30s',
      },
    },
    thresholds: {
      ...THRESHOLDS,
      'http_req_duration': ['p(95)<2000'],  // Allow higher latency during spike
      'http_req_failed': ['rate<0.05'],      // Allow up to 5% errors
    },
  },

  // Stress test - find breaking points
  stress: {
    scenarios: {
      stress_test: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: LOAD_STAGES.stress.stages,
        gracefulRampDown: '60s',
      },
    },
    thresholds: {
      ...THRESHOLDS,
      'http_req_duration': ['p(95)<3000'],
      'http_req_failed': ['rate<0.10'],
    },
  },

  // Breakpoint test - find the absolute limit
  breakpoint: {
    scenarios: {
      breakpoint_test: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: LOAD_STAGES.breakpoint.stages,
        gracefulRampDown: '30s',
      },
    },
    thresholds: {
      // No failure thresholds - we want to find where it breaks
      'http_req_duration': ['avg<5000'],
    },
  },

  // Soak test - extended duration for memory leaks
  soak: {
    scenarios: {
      soak_test: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: LOAD_STAGES.soak.stages,
        gracefulRampDown: '5m',
      },
    },
    thresholds: {
      ...THRESHOLDS,
      'http_req_duration': ['p(95)<1000'],  // Stricter - should stay consistent
      'http_req_failed': ['rate<0.01'],      // Very low error rate expected
    },
  },

  // Concurrent uploads - test file upload under load
  concurrent_uploads: {
    scenarios: {
      upload_stress: {
        executor: 'constant-vus',
        vus: 50,
        duration: '5m',
      },
    },
    thresholds: {
      'http_req_duration{type:upload}': ['p(95)<10000'],
      'http_req_failed{type:upload}': ['rate<0.10'],
    },
  },

  // Database stress - heavy query load
  database_stress: {
    scenarios: {
      db_stress: {
        executor: 'constant-arrival-rate',
        rate: 200,
        timeUnit: '1s',
        duration: '5m',
        preAllocatedVUs: 100,
        maxVUs: 300,
      },
    },
    thresholds: {
      'http_req_duration{endpoint:projects_list}': ['p(95)<500'],
      'http_req_duration{endpoint:subs_list}': ['p(95)<500'],
      'http_req_failed': ['rate<0.05'],
    },
  },

  // Bulk operations - test bulk import under load
  bulk_operations: {
    scenarios: {
      bulk_ops: {
        executor: 'per-vu-iterations',
        vus: 20,
        iterations: 5,
        maxDuration: '30m',
      },
    },
    thresholds: {
      'http_req_duration{endpoint:subs_import}': ['p(95)<30000'],
      'http_req_failed{endpoint:subs_import}': ['rate<0.20'],
    },
  },
};

// Export the selected scenario configuration
export const options = scenarioConfigs[SCENARIO] || scenarioConfigs.spike;

export default function () {
  switch (SCENARIO) {
    case 'concurrent_uploads':
      runConcurrentUploads();
      break;
    case 'database_stress':
      runDatabaseStress();
      break;
    case 'bulk_operations':
      runBulkOperations();
      break;
    default:
      runMixedWorkload();
  }
}

/**
 * Mixed workload - standard stress test
 */
function runMixedWorkload() {
  const authData = login();
  if (!authData) {
    stressErrors.add(1);
    return;
  }

  group('Mixed Workload', () => {
    // Dashboard operations (40% of traffic)
    if (Math.random() < 0.4) {
      const res = dashboardApi.getNotifications(authData);
      throughput.add(1);
      if (res.status >= 500) stressErrors.add(1);
    }

    // Project operations (25% of traffic)
    if (Math.random() < 0.25) {
      const res = projectsApi.list(authData, '?limit=10');
      throughput.add(1);
      if (res.status >= 500) stressErrors.add(1);

      // Sometimes create a project
      if (Math.random() < 0.1) {
        const project = generateProject();
        const createRes = projectsApi.create(authData, project);
        throughput.add(1);
        if (createRes.status >= 500) stressErrors.add(1);
      }
    }

    // Subcontractor operations (20% of traffic)
    if (Math.random() < 0.2) {
      const res = subcontractorsApi.list(authData, '?limit=20');
      throughput.add(1);
      if (res.status >= 500) stressErrors.add(1);

      // Sometimes create a subcontractor
      if (Math.random() < 0.1) {
        const sub = generateSubcontractor();
        const createRes = subcontractorsApi.create(authData, sub);
        throughput.add(1);
        if (createRes.status >= 500) stressErrors.add(1);
      }
    }

    // Document operations (10% of traffic)
    if (Math.random() < 0.1) {
      const res = documentsApi.list(authData, '?limit=10');
      throughput.add(1);
      if (res.status >= 500) stressErrors.add(1);
    }

    // Heavy operations (5% of traffic)
    if (Math.random() < 0.05) {
      const res = dashboardApi.getComplianceHistory(authData);
      throughput.add(1);
      if (res.status >= 500) stressErrors.add(1);
    }
  });

  logout(authData);
  sleep(Math.random() * 2);
}

/**
 * Concurrent uploads stress test
 */
function runConcurrentUploads() {
  const authData = login();
  if (!authData) {
    stressErrors.add(1);
    return;
  }

  group('Concurrent Uploads', () => {
    // Get a subcontractor
    const subsRes = subcontractorsApi.list(authData, '?limit=1');
    const subsData = parseResponse(subsRes);
    const subs = subsData?.subcontractors || subsData?.data || [];

    let subId = null;
    if (subs.length > 0) {
      subId = subs[0].id;
    } else {
      // Create one
      const newSub = generateSubcontractor();
      const createRes = subcontractorsApi.create(authData, newSub);
      const createData = parseResponse(createRes);
      subId = createData?.id;
    }

    if (subId) {
      // Upload multiple documents in sequence
      for (let i = 0; i < 3; i++) {
        const pdfContent = generateFakePDF();
        const fileName = `stress_test_${Date.now()}_${i}.pdf`;

        const uploadRes = apiUpload(
          '/documents',
          pdfContent,
          fileName,
          authData,
          {
            subcontractor_id: subId,
            document_type: 'public_liability',
          }
        );

        throughput.add(1);

        check(uploadRes, {
          'upload successful': (r) => r.status === 200 || r.status === 201,
        });

        if (uploadRes.status >= 500) {
          stressErrors.add(1);
        }

        sleep(0.5);
      }
    }
  });

  logout(authData);
  sleep(1);
}

/**
 * Database stress test - heavy read operations
 */
function runDatabaseStress() {
  const authData = login();
  if (!authData) {
    stressErrors.add(1);
    return;
  }

  group('Database Stress', () => {
    // Rapid-fire queries
    const queries = [
      () => projectsApi.list(authData, '?limit=50'),
      () => subcontractorsApi.list(authData, '?limit=100'),
      () => documentsApi.list(authData, '?limit=50'),
      () => dashboardApi.getNotifications(authData),
      () => dashboardApi.getExpirations(authData),
      () => dashboardApi.getComplianceHistory(authData),
    ];

    // Execute random queries
    for (let i = 0; i < 5; i++) {
      const query = queries[Math.floor(Math.random() * queries.length)];
      const res = query();
      throughput.add(1);

      if (res.status >= 500) {
        stressErrors.add(1);
      }

      // Minimal sleep between queries
      sleep(0.1);
    }
  });

  logout(authData);
}

/**
 * Bulk operations stress test
 */
function runBulkOperations() {
  const authData = login();
  if (!authData) {
    stressErrors.add(1);
    return;
  }

  group('Bulk Operations', () => {
    // Generate bulk import CSV (100 subcontractors)
    const csvData = generateBulkImportCSV(100);
    const startTime = Date.now();

    // Upload bulk import
    const importRes = subcontractorsApi.import(authData, csvData);
    throughput.add(1);

    const duration = Date.now() - startTime;
    console.log(`Bulk import completed in ${duration}ms`);

    check(importRes, {
      'bulk import accepted': (r) => r.status === 200 || r.status === 201 || r.status === 202,
    });

    if (importRes.status >= 500) {
      stressErrors.add(1);
    }

    // Wait for processing
    sleep(5);

    // Verify by listing subcontractors
    const listRes = subcontractorsApi.list(authData, '?limit=100');
    check(listRes, {
      'can list after bulk import': (r) => r.status === 200,
    });
  });

  logout(authData);
  sleep(2);
}

/**
 * Test recovery after errors
 */
function testRecovery(authData) {
  const startTime = Date.now();

  // Make a request that might fail under load
  let res = projectsApi.list(authData);

  if (res.status >= 500) {
    // Server error - wait and retry
    sleep(1);
    res = projectsApi.list(authData);

    if (res.status === 200) {
      const recovery = Date.now() - startTime;
      recoveryTime.add(recovery);
    }
  }

  return res.status === 200;
}

// Setup function
export function setup() {
  console.log(`Starting ${SCENARIO} stress test...`);
  console.log(`Target: ${ENV.BASE_URL}`);

  // Warm up the server
  const warmupAuth = login();
  if (warmupAuth) {
    for (let i = 0; i < 5; i++) {
      projectsApi.list(warmupAuth);
      sleep(0.5);
    }
    logout(warmupAuth);
  }

  return { startTime: Date.now(), scenario: SCENARIO };
}

// Teardown function
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`${data.scenario} stress test completed in ${duration}ms`);
}

// Handle summary at end
export function handleSummary(data) {
  const summary = {
    scenario: SCENARIO,
    timestamp: new Date().toISOString(),
    metrics: {
      http_reqs: data.metrics.http_reqs?.values?.count || 0,
      http_req_failed: data.metrics.http_req_failed?.values?.rate || 0,
      http_req_duration_avg: data.metrics.http_req_duration?.values?.avg || 0,
      http_req_duration_p95: data.metrics.http_req_duration?.values['p(95)'] || 0,
      http_req_duration_max: data.metrics.http_req_duration?.values?.max || 0,
      stress_errors: data.metrics.stress_errors?.values?.count || 0,
      throughput: data.metrics.throughput?.values?.count || 0,
    },
  };

  return {
    [`stress-${SCENARIO}-summary.json`]: JSON.stringify(summary, null, 2),
  };
}
