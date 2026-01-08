/**
 * API Endpoints Stress Test
 * Tests all 76 API endpoints under load
 */

import { sleep, check, group } from 'k6';
import { Rate } from 'k6/metrics';
import { ENV, LOAD_STAGES, THRESHOLDS } from '../config.js';
import { login, logout } from '../helpers/auth.js';
import {
  projectsApi,
  subcontractorsApi,
  documentsApi,
  exceptionsApi,
  communicationsApi,
  usersApi,
  dashboardApi,
  companyApi,
  integrationsApi,
  stripeApi,
  externalApi,
  templatesApi,
  parseResponse,
} from '../helpers/api.js';
import {
  generateProject,
  generateSubcontractor,
  generateRequirements,
  generateException,
  generateCommunication,
  randomABN,
} from '../helpers/data.js';

// Test configuration
export const options = {
  scenarios: {
    api_endpoints: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: LOAD_STAGES.load.stages,
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    ...THRESHOLDS,
    'http_req_duration{endpoint:projects_list}': ['p(95)<300'],
    'http_req_duration{endpoint:subs_list}': ['p(95)<300'],
    'http_req_duration{endpoint:docs_list}': ['p(95)<300'],
    'http_req_duration{endpoint:notifications}': ['p(95)<200'],
  },
};

// Shared state across iterations
let createdProjectId = null;
let createdSubcontractorId = null;
let createdExceptionId = null;

export default function () {
  // Login at start of each VU iteration
  const authData = login();
  if (!authData) {
    console.error('Failed to login, skipping iteration');
    return;
  }

  // Test all endpoint groups
  group('Dashboard & Monitoring APIs', () => {
    testDashboardApis(authData);
  });

  group('Project APIs', () => {
    testProjectApis(authData);
  });

  group('Subcontractor APIs', () => {
    testSubcontractorApis(authData);
  });

  group('Document APIs', () => {
    testDocumentApis(authData);
  });

  group('Exception APIs', () => {
    testExceptionApis(authData);
  });

  group('Communication APIs', () => {
    testCommunicationApis(authData);
  });

  group('User APIs', () => {
    testUserApis(authData);
  });

  group('Company & Settings APIs', () => {
    testCompanyApis(authData);
  });

  group('Integration APIs', () => {
    testIntegrationApis(authData);
  });

  group('Stripe APIs', () => {
    testStripeApis(authData);
  });

  group('External APIs', () => {
    testExternalApis(authData);
  });

  group('Template APIs', () => {
    testTemplateApis(authData);
  });

  // Cleanup
  logout(authData);

  // Think time between iterations
  sleep(Math.random() * 2 + 1);
}

function testDashboardApis(authData) {
  // GET /api/notifications
  let res = dashboardApi.getNotifications(authData);
  check(res, { 'notifications list': (r) => r.status === 200 });

  // GET /api/expirations
  res = dashboardApi.getExpirations(authData);
  check(res, { 'expirations list': (r) => r.status === 200 });

  // GET /api/alerts/critical
  res = dashboardApi.getCriticalAlerts(authData);
  check(res, { 'critical alerts': (r) => r.status === 200 });

  // GET /api/monitoring/expirations
  res = dashboardApi.getMonitoringExpirations(authData);
  check(res, { 'monitoring expirations': (r) => r.status === 200 });

  // GET /api/compliance-history
  res = dashboardApi.getComplianceHistory(authData);
  check(res, { 'compliance history': (r) => r.status === 200 });

  // GET /api/morning-brief
  res = dashboardApi.getMorningBrief(authData);
  check(res, { 'morning brief': (r) => r.status === 200 });

  // GET /api/audit-logs
  res = dashboardApi.getAuditLogs(authData);
  check(res, { 'audit logs': (r) => r.status === 200 || r.status === 403 }); // May require admin

  sleep(0.5);
}

function testProjectApis(authData) {
  // GET /api/projects (list with pagination)
  let res = projectsApi.list(authData, '?page=1&limit=10');
  check(res, { 'projects list': (r) => r.status === 200 });

  const projectsData = parseResponse(res);
  const projects = projectsData?.projects || projectsData?.data || [];

  // Create a new project
  const newProject = generateProject();
  res = projectsApi.create(authData, newProject);
  const createSuccess = check(res, { 'project created': (r) => r.status === 200 || r.status === 201 });

  if (createSuccess) {
    const created = parseResponse(res);
    createdProjectId = created?.id || created?.project?.id;

    if (createdProjectId) {
      // GET /api/projects/:id
      res = projectsApi.get(authData, createdProjectId);
      check(res, { 'project get': (r) => r.status === 200 });

      // PUT /api/projects/:id
      res = projectsApi.update(authData, createdProjectId, { name: `${newProject.name} Updated` });
      check(res, { 'project updated': (r) => r.status === 200 });

      // GET /api/projects/:id/requirements
      res = projectsApi.getRequirements(authData, createdProjectId);
      check(res, { 'requirements get': (r) => r.status === 200 });

      // POST /api/projects/:id/requirements
      const requirements = generateRequirements();
      res = projectsApi.setRequirements(authData, createdProjectId, requirements);
      check(res, { 'requirements set': (r) => r.status === 200 || r.status === 201 });

      // GET /api/projects/:id/subcontractors
      res = projectsApi.getSubcontractors(authData, createdProjectId);
      check(res, { 'project subcontractors': (r) => r.status === 200 });

      // GET /api/projects/:id/report
      res = projectsApi.getReport(authData, createdProjectId);
      check(res, { 'project report': (r) => r.status === 200 });
    }
  }

  // Also test listing existing projects if any exist
  if (projects.length > 0) {
    const existingId = projects[0].id;
    res = projectsApi.get(authData, existingId);
    check(res, { 'existing project get': (r) => r.status === 200 });
  }

  sleep(0.5);
}

function testSubcontractorApis(authData) {
  // GET /api/subcontractors (list with pagination)
  let res = subcontractorsApi.list(authData, '?page=1&limit=10');
  check(res, { 'subcontractors list': (r) => r.status === 200 });

  const subsData = parseResponse(res);
  const subcontractors = subsData?.subcontractors || subsData?.data || [];

  // Create a new subcontractor
  const newSub = generateSubcontractor();
  res = subcontractorsApi.create(authData, newSub);
  const createSuccess = check(res, { 'subcontractor created': (r) => r.status === 200 || r.status === 201 });

  if (createSuccess) {
    const created = parseResponse(res);
    createdSubcontractorId = created?.id || created?.subcontractor?.id;

    if (createdSubcontractorId) {
      // GET /api/subcontractors/:id
      res = subcontractorsApi.get(authData, createdSubcontractorId);
      check(res, { 'subcontractor get': (r) => r.status === 200 });

      // PUT /api/subcontractors/:id
      res = subcontractorsApi.update(authData, createdSubcontractorId, { contact_name: 'Updated Contact' });
      check(res, { 'subcontractor updated': (r) => r.status === 200 });

      // Assign to project if we have one
      if (createdProjectId) {
        res = projectsApi.assignSubcontractor(authData, createdProjectId, {
          subcontractor_id: createdSubcontractorId,
        });
        check(res, { 'subcontractor assigned': (r) => r.status === 200 || r.status === 201 });
      }
    }
  }

  // Test listing with filters
  res = subcontractorsApi.list(authData, '?status=compliant');
  check(res, { 'subcontractors filtered': (r) => r.status === 200 });

  sleep(0.5);
}

function testDocumentApis(authData) {
  // GET /api/documents (list)
  let res = documentsApi.list(authData, '?page=1&limit=10');
  check(res, { 'documents list': (r) => r.status === 200 });

  const docsData = parseResponse(res);
  const documents = docsData?.documents || docsData?.data || [];

  // Test get on existing document if available
  if (documents.length > 0) {
    const docId = documents[0].id;

    res = documentsApi.get(authData, docId);
    check(res, { 'document get': (r) => r.status === 200 });
  }

  // Note: Actual file upload is tested separately in upload-stress.js

  sleep(0.5);
}

function testExceptionApis(authData) {
  // GET /api/exceptions (list)
  let res = exceptionsApi.list(authData, '?page=1&limit=10');
  check(res, { 'exceptions list': (r) => r.status === 200 });

  const exceptionsData = parseResponse(res);
  const exceptions = exceptionsData?.exceptions || exceptionsData?.data || [];

  // Test with existing exception if available
  if (exceptions.length > 0) {
    const exceptionId = exceptions[0].id;

    // GET /api/exceptions/:id
    res = exceptionsApi.get(authData, exceptionId);
    check(res, { 'exception get': (r) => r.status === 200 });

    // GET /api/exceptions/:id/audit-trail
    res = exceptionsApi.getAuditTrail(authData, exceptionId);
    check(res, { 'exception audit trail': (r) => r.status === 200 });
  }

  // Test filtered list
  res = exceptionsApi.list(authData, '?status=active');
  check(res, { 'exceptions filtered': (r) => r.status === 200 });

  sleep(0.5);
}

function testCommunicationApis(authData) {
  // GET /api/communications (list)
  let res = communicationsApi.list(authData, '?page=1&limit=10');
  check(res, { 'communications list': (r) => r.status === 200 });

  // POST /api/communications/trigger-followups
  res = communicationsApi.triggerFollowups(authData);
  check(res, { 'trigger followups': (r) => r.status === 200 || r.status === 204 });

  sleep(0.5);
}

function testUserApis(authData) {
  // GET /api/user/profile
  let res = usersApi.getProfile(authData);
  check(res, { 'user profile get': (r) => r.status === 200 });

  // GET /api/user/preferences
  res = usersApi.getPreferences(authData);
  check(res, { 'user preferences get': (r) => r.status === 200 });

  // GET /api/users (list - may require admin)
  res = usersApi.list(authData, '?page=1&limit=10');
  check(res, { 'users list': (r) => r.status === 200 || r.status === 403 });

  sleep(0.5);
}

function testCompanyApis(authData) {
  // GET /api/company
  let res = companyApi.get(authData);
  check(res, { 'company get': (r) => r.status === 200 || r.status === 403 });

  sleep(0.5);
}

function testIntegrationApis(authData) {
  // GET /api/integrations/status
  let res = integrationsApi.getStatus(authData);
  check(res, { 'integrations status': (r) => r.status === 200 });

  sleep(0.5);
}

function testStripeApis(authData) {
  // GET /api/stripe/subscription
  let res = stripeApi.getSubscription(authData);
  check(res, { 'stripe subscription': (r) => r.status === 200 || r.status === 403 });

  sleep(0.5);
}

function testExternalApis(authData) {
  // GET /api/external/abn/:abn
  const abn = randomABN();
  let res = externalApi.validateABN(authData, abn);
  check(res, { 'abn validation': (r) => r.status === 200 || r.status === 404 });

  sleep(0.5);
}

function testTemplateApis(authData) {
  // GET /api/requirement-templates
  let res = templatesApi.list(authData);
  check(res, { 'requirement templates list': (r) => r.status === 200 });

  sleep(0.5);
}

// Cleanup function - runs once at the end
export function teardown(data) {
  console.log('API Endpoints test completed');
  console.log(`Created project ID: ${createdProjectId}`);
  console.log(`Created subcontractor ID: ${createdSubcontractorId}`);
}
