/**
 * Main Test Runner
 * Comprehensive stress test that runs all test suites
 */

import { sleep, group } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { ENV, LOAD_STAGES, THRESHOLDS } from './config.js';
import { login, logout } from './helpers/auth.js';
import {
  projectsApi,
  subcontractorsApi,
  documentsApi,
  dashboardApi,
  parseResponse,
} from './helpers/api.js';
import { generateProject, generateSubcontractor } from './helpers/data.js';

// Test configuration - selectable via environment variable
const TEST_TYPE = __ENV.TEST_TYPE || 'smoke';

const testConfigs = {
  smoke: {
    stages: LOAD_STAGES.smoke.stages,
    description: 'Quick smoke test to verify system works',
  },
  load: {
    stages: LOAD_STAGES.load.stages,
    description: 'Standard load test for normal expected traffic',
  },
  stress: {
    stages: LOAD_STAGES.stress.stages,
    description: 'Stress test to find breaking points',
  },
  spike: {
    stages: LOAD_STAGES.spike.stages,
    description: 'Spike test for sudden traffic surges',
  },
  soak: {
    stages: LOAD_STAGES.soak.stages,
    description: 'Soak test for extended duration (memory leaks)',
  },
};

const config = testConfigs[TEST_TYPE] || testConfigs.smoke;

export const options = {
  scenarios: {
    main_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: config.stages,
      gracefulRampDown: '30s',
    },
  },
  thresholds: THRESHOLDS,
};

export default function () {
  const authData = login();
  if (!authData) {
    console.error('Login failed');
    sleep(1);
    return;
  }

  // Weighted mix of operations based on real-world usage
  const random = Math.random();

  if (random < 0.35) {
    // Dashboard operations (35%)
    group('Dashboard', () => {
      dashboardApi.getNotifications(authData);
      dashboardApi.getExpirations(authData);
      if (Math.random() < 0.3) {
        dashboardApi.getComplianceHistory(authData);
      }
    });
  } else if (random < 0.60) {
    // Project operations (25%)
    group('Projects', () => {
      const res = projectsApi.list(authData, '?limit=10');
      const data = parseResponse(res);
      const projects = data?.projects || data?.data || [];

      if (projects.length > 0 && Math.random() < 0.3) {
        projectsApi.get(authData, projects[0].id);
        projectsApi.getReport(authData, projects[0].id);
      }

      if (Math.random() < 0.05) {
        projectsApi.create(authData, generateProject());
      }
    });
  } else if (random < 0.80) {
    // Subcontractor operations (20%)
    group('Subcontractors', () => {
      subcontractorsApi.list(authData, '?limit=20');

      if (Math.random() < 0.05) {
        subcontractorsApi.create(authData, generateSubcontractor());
      }
    });
  } else if (random < 0.95) {
    // Document operations (15%)
    group('Documents', () => {
      documentsApi.list(authData, '?limit=10');
    });
  } else {
    // Heavy operations (5%)
    group('Heavy Operations', () => {
      dashboardApi.getMorningBrief(authData);
      dashboardApi.getAuditLogs(authData, '?limit=50');
    });
  }

  logout(authData);

  // Think time
  sleep(Math.random() * 2 + 0.5);
}

export function setup() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RiskShield AI Stress Test Suite`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Test Type: ${TEST_TYPE}`);
  console.log(`Description: ${config.description}`);
  console.log(`Target: ${ENV.BASE_URL}`);
  console.log(`${'='.repeat(60)}\n`);

  return {
    startTime: Date.now(),
    testType: TEST_TYPE,
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test completed in ${duration.toFixed(2)} seconds`);
  console.log(`${'='.repeat(60)}\n`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    [`results/summary-${TEST_TYPE}-${timestamp}.html`]: htmlReport(data),
    [`results/summary-${TEST_TYPE}-${timestamp}.json`]: JSON.stringify(data, null, 2),
  };
}
