/**
 * User Journey Stress Tests
 * Simulates complete user workflows under load
 */

import { sleep, check, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import http from 'k6/http';
import { ENV, LOAD_STAGES, THRESHOLDS } from '../config.js';
import { login, logout, signup } from '../helpers/auth.js';
import {
  projectsApi,
  subcontractorsApi,
  documentsApi,
  exceptionsApi,
  communicationsApi,
  dashboardApi,
  stripeApi,
  parseResponse,
  apiUpload,
} from '../helpers/api.js';
import {
  generateProject,
  generateSubcontractor,
  generateRequirements,
  generateException,
  generateFakePDF,
  randomEmail,
} from '../helpers/data.js';

// Custom metrics for journeys
const journeyComplete = new Rate('journey_complete');
const journeyDuration = new Trend('journey_duration');
const signupJourneyComplete = new Rate('signup_journey_complete');
const documentJourneyComplete = new Rate('document_journey_complete');
const exceptionJourneyComplete = new Rate('exception_journey_complete');

// Test configuration
export const options = {
  scenarios: {
    user_journeys: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: LOAD_STAGES.load.stages,
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    ...THRESHOLDS,
    'journey_complete': ['rate>0.85'],
    'signup_journey_complete': ['rate>0.90'],
    'document_journey_complete': ['rate>0.80'],
    'exception_journey_complete': ['rate>0.85'],
    'journey_duration': ['p(95)<30000'],  // 95% of journeys under 30s
  },
};

// Weighted scenario selection
const SCENARIOS = [
  { name: 'signup_and_setup', weight: 0.15, fn: journeySignupAndSetup },
  { name: 'document_upload_verification', weight: 0.30, fn: journeyDocumentUploadVerification },
  { name: 'exception_management', weight: 0.15, fn: journeyExceptionManagement },
  { name: 'dashboard_monitoring', weight: 0.25, fn: journeyDashboardMonitoring },
  { name: 'project_management', weight: 0.15, fn: journeyProjectManagement },
];

export default function () {
  const startTime = Date.now();

  // Select scenario based on weight
  const scenario = selectScenario();

  try {
    const success = scenario.fn();
    journeyComplete.add(success);
  } catch (error) {
    console.error(`Journey ${scenario.name} failed: ${error}`);
    journeyComplete.add(false);
  }

  const duration = Date.now() - startTime;
  journeyDuration.add(duration);

  // Think time between journeys
  sleep(Math.random() * 3 + 2);
}

function selectScenario() {
  const random = Math.random();
  let cumulative = 0;

  for (const scenario of SCENARIOS) {
    cumulative += scenario.weight;
    if (random <= cumulative) {
      return scenario;
    }
  }

  return SCENARIOS[0];
}

/**
 * Journey 1: Signup and Initial Project Setup
 * New user signs up, creates company, sets up first project
 */
function journeySignupAndSetup() {
  const journeyStart = Date.now();

  return group('Journey: Signup and Setup', () => {
    // Step 1: Visit landing page (simulated)
    sleep(1);

    // Step 2: Sign up
    const email = randomEmail('journey');
    const authData = signup({
      email: email,
      password: 'TestPassword123!',
      name: 'Journey Test User',
      company_name: 'Journey Test Company',
    });

    if (!authData) {
      signupJourneyComplete.add(false);
      return false;
    }

    check(authData, { 'signup successful': (a) => a !== null });
    sleep(0.5);

    // Step 3: Create first project
    const project = generateProject();
    const projectRes = projectsApi.create(authData, project);
    const projectCreated = check(projectRes, {
      'project created': (r) => r.status === 200 || r.status === 201,
    });

    if (!projectCreated) {
      signupJourneyComplete.add(false);
      return false;
    }

    const projectData = parseResponse(projectRes);
    const projectId = projectData?.id || projectData?.project?.id;
    sleep(0.5);

    // Step 4: Set insurance requirements
    if (projectId) {
      const requirements = generateRequirements();
      const reqRes = projectsApi.setRequirements(authData, projectId, requirements);
      check(reqRes, { 'requirements set': (r) => r.status === 200 || r.status === 201 });
    }
    sleep(0.5);

    // Step 5: Create first subcontractor
    const subcontractor = generateSubcontractor();
    const subRes = subcontractorsApi.create(authData, subcontractor);
    const subCreated = check(subRes, {
      'subcontractor created': (r) => r.status === 200 || r.status === 201,
    });

    if (!subCreated) {
      signupJourneyComplete.add(false);
      return false;
    }

    const subData = parseResponse(subRes);
    const subId = subData?.id || subData?.subcontractor?.id;
    sleep(0.5);

    // Step 6: Assign subcontractor to project
    if (projectId && subId) {
      const assignRes = projectsApi.assignSubcontractor(authData, projectId, {
        subcontractor_id: subId,
      });
      check(assignRes, { 'subcontractor assigned': (r) => r.status === 200 || r.status === 201 });
    }

    // Step 7: View dashboard
    const dashRes = dashboardApi.getNotifications(authData);
    check(dashRes, { 'dashboard loaded': (r) => r.status === 200 });

    // Cleanup
    logout(authData);

    const success = projectCreated && subCreated;
    signupJourneyComplete.add(success);

    console.log(`Signup journey completed in ${Date.now() - journeyStart}ms`);
    return success;
  });
}

/**
 * Journey 2: Document Upload and Verification
 * User uploads COC document, system processes and verifies
 */
function journeyDocumentUploadVerification() {
  return group('Journey: Document Upload & Verification', () => {
    // Login
    const authData = login();
    if (!authData) {
      documentJourneyComplete.add(false);
      return false;
    }

    // Step 1: Navigate to documents
    let res = documentsApi.list(authData);
    check(res, { 'documents list loaded': (r) => r.status === 200 });
    sleep(0.5);

    // Step 2: Get a subcontractor to upload for
    res = subcontractorsApi.list(authData, '?limit=1');
    const subsData = parseResponse(res);
    const subcontractors = subsData?.subcontractors || subsData?.data || [];

    if (subcontractors.length === 0) {
      // Create one if none exist
      const newSub = generateSubcontractor();
      const subRes = subcontractorsApi.create(authData, newSub);
      const subData = parseResponse(subRes);
      if (subData) {
        subcontractors.push(subData);
      }
    }

    if (subcontractors.length === 0) {
      documentJourneyComplete.add(false);
      logout(authData);
      return false;
    }

    const subcontractorId = subcontractors[0].id;

    // Step 3: Get a project
    res = projectsApi.list(authData, '?limit=1');
    const projectsData = parseResponse(res);
    const projects = projectsData?.projects || projectsData?.data || [];
    const projectId = projects.length > 0 ? projects[0].id : null;

    // Step 4: Upload document
    const pdfContent = generateFakePDF();
    const fileName = `COC_test_${Date.now()}.pdf`;

    const uploadRes = apiUpload(
      '/documents',
      pdfContent,
      fileName,
      authData,
      {
        subcontractor_id: subcontractorId,
        project_id: projectId,
        document_type: 'public_liability',
      }
    );

    const uploadSuccess = check(uploadRes, {
      'document uploaded': (r) => r.status === 200 || r.status === 201,
    });

    if (!uploadSuccess) {
      documentJourneyComplete.add(false);
      logout(authData);
      return false;
    }

    const docData = parseResponse(uploadRes);
    const documentId = docData?.id || docData?.document?.id;
    sleep(1);

    // Step 5: Check processing status
    if (documentId) {
      res = documentsApi.get(authData, documentId);
      check(res, { 'document status retrieved': (r) => r.status === 200 });
      sleep(0.5);

      // Step 6: Trigger verification (if not auto-verified)
      res = documentsApi.verify(authData, documentId);
      check(res, { 'verification triggered': (r) => r.status === 200 || r.status === 202 || r.status === 400 });
    }

    // Step 7: Check notifications for result
    res = dashboardApi.getNotifications(authData);
    check(res, { 'notifications checked': (r) => r.status === 200 });

    logout(authData);

    documentJourneyComplete.add(uploadSuccess);
    return uploadSuccess;
  });
}

/**
 * Journey 3: Exception Management
 * User creates and manages compliance exception
 */
function journeyExceptionManagement() {
  return group('Journey: Exception Management', () => {
    const authData = login();
    if (!authData) {
      exceptionJourneyComplete.add(false);
      return false;
    }

    // Step 1: View exceptions list
    let res = exceptionsApi.list(authData);
    check(res, { 'exceptions list loaded': (r) => r.status === 200 });
    sleep(0.5);

    // Step 2: Get project-subcontractor assignments
    res = projectsApi.list(authData, '?limit=1');
    const projectsData = parseResponse(res);
    const projects = projectsData?.projects || projectsData?.data || [];

    if (projects.length === 0) {
      exceptionJourneyComplete.add(false);
      logout(authData);
      return false;
    }

    const projectId = projects[0].id;

    // Get subcontractors for this project
    res = projectsApi.getSubcontractors(authData, projectId);
    const psData = parseResponse(res);
    const projectSubs = psData?.project_subcontractors || psData?.data || [];

    let journeySuccess = true;

    if (projectSubs.length > 0) {
      // Step 3: Create exception
      const exception = generateException(projectSubs[0].id);
      res = exceptionsApi.create(authData, exception);
      const created = check(res, {
        'exception created': (r) => r.status === 200 || r.status === 201,
      });

      if (created) {
        const exData = parseResponse(res);
        const exceptionId = exData?.id || exData?.exception?.id;
        sleep(0.5);

        if (exceptionId) {
          // Step 4: View exception details
          res = exceptionsApi.get(authData, exceptionId);
          check(res, { 'exception details loaded': (r) => r.status === 200 });
          sleep(0.3);

          // Step 5: View audit trail
          res = exceptionsApi.getAuditTrail(authData, exceptionId);
          check(res, { 'audit trail loaded': (r) => r.status === 200 });
          sleep(0.3);

          // Step 6: Update exception (approve it)
          res = exceptionsApi.update(authData, exceptionId, { status: 'active' });
          check(res, { 'exception approved': (r) => r.status === 200 });
        }
      } else {
        journeySuccess = false;
      }
    }

    // Step 7: Check dashboard for updates
    res = dashboardApi.getCriticalAlerts(authData);
    check(res, { 'critical alerts loaded': (r) => r.status === 200 });

    logout(authData);

    exceptionJourneyComplete.add(journeySuccess);
    return journeySuccess;
  });
}

/**
 * Journey 4: Dashboard Monitoring
 * User checks various dashboard views and reports
 */
function journeyDashboardMonitoring() {
  return group('Journey: Dashboard Monitoring', () => {
    const authData = login();
    if (!authData) {
      return false;
    }

    let allChecksPass = true;

    // Step 1: Load main dashboard (notifications)
    let res = dashboardApi.getNotifications(authData);
    allChecksPass = check(res, { 'notifications': (r) => r.status === 200 }) && allChecksPass;
    sleep(0.3);

    // Step 2: Check expirations
    res = dashboardApi.getExpirations(authData);
    allChecksPass = check(res, { 'expirations': (r) => r.status === 200 }) && allChecksPass;
    sleep(0.3);

    // Step 3: Check critical alerts
    res = dashboardApi.getCriticalAlerts(authData);
    allChecksPass = check(res, { 'critical alerts': (r) => r.status === 200 }) && allChecksPass;
    sleep(0.3);

    // Step 4: View monitoring expirations
    res = dashboardApi.getMonitoringExpirations(authData);
    allChecksPass = check(res, { 'monitoring': (r) => r.status === 200 }) && allChecksPass;
    sleep(0.3);

    // Step 5: Check compliance history
    res = dashboardApi.getComplianceHistory(authData);
    allChecksPass = check(res, { 'compliance history': (r) => r.status === 200 }) && allChecksPass;
    sleep(0.3);

    // Step 6: Get morning brief
    res = dashboardApi.getMorningBrief(authData);
    allChecksPass = check(res, { 'morning brief': (r) => r.status === 200 }) && allChecksPass;
    sleep(0.3);

    // Step 7: View some projects
    res = projectsApi.list(authData, '?limit=5');
    allChecksPass = check(res, { 'projects list': (r) => r.status === 200 }) && allChecksPass;

    const projectsData = parseResponse(res);
    const projects = projectsData?.projects || projectsData?.data || [];

    // Step 8: View project report for first project
    if (projects.length > 0) {
      res = projectsApi.getReport(authData, projects[0].id);
      allChecksPass = check(res, { 'project report': (r) => r.status === 200 }) && allChecksPass;
    }

    // Step 9: View subcontractors
    res = subcontractorsApi.list(authData, '?limit=10');
    allChecksPass = check(res, { 'subcontractors list': (r) => r.status === 200 }) && allChecksPass;

    // Step 10: View documents
    res = documentsApi.list(authData, '?limit=10');
    allChecksPass = check(res, { 'documents list': (r) => r.status === 200 }) && allChecksPass;

    logout(authData);
    return allChecksPass;
  });
}

/**
 * Journey 5: Project Management
 * User creates and manages a project with subcontractors
 */
function journeyProjectManagement() {
  return group('Journey: Project Management', () => {
    const authData = login();
    if (!authData) {
      return false;
    }

    // Step 1: List existing projects
    let res = projectsApi.list(authData);
    check(res, { 'projects loaded': (r) => r.status === 200 });
    sleep(0.3);

    // Step 2: Create new project
    const project = generateProject();
    res = projectsApi.create(authData, project);
    const created = check(res, {
      'new project created': (r) => r.status === 200 || r.status === 201,
    });

    if (!created) {
      logout(authData);
      return false;
    }

    const projectData = parseResponse(res);
    const projectId = projectData?.id || projectData?.project?.id;
    sleep(0.3);

    if (projectId) {
      // Step 3: View project details
      res = projectsApi.get(authData, projectId);
      check(res, { 'project details': (r) => r.status === 200 });
      sleep(0.3);

      // Step 4: Set requirements
      const requirements = generateRequirements();
      res = projectsApi.setRequirements(authData, projectId, requirements);
      check(res, { 'requirements set': (r) => r.status === 200 || r.status === 201 });
      sleep(0.3);

      // Step 5: Create and assign 3 subcontractors
      for (let i = 0; i < 3; i++) {
        const sub = generateSubcontractor();
        const subRes = subcontractorsApi.create(authData, sub);

        if (subRes.status === 200 || subRes.status === 201) {
          const subData = parseResponse(subRes);
          const subId = subData?.id || subData?.subcontractor?.id;

          if (subId) {
            projectsApi.assignSubcontractor(authData, projectId, { subcontractor_id: subId });
          }
        }
        sleep(0.2);
      }

      // Step 6: View project subcontractors
      res = projectsApi.getSubcontractors(authData, projectId);
      check(res, { 'project subs listed': (r) => r.status === 200 });
      sleep(0.3);

      // Step 7: Update project
      res = projectsApi.update(authData, projectId, {
        name: `${project.name} - Updated`,
        status: 'active',
      });
      check(res, { 'project updated': (r) => r.status === 200 });
      sleep(0.3);

      // Step 8: Get project report
      res = projectsApi.getReport(authData, projectId);
      check(res, { 'report generated': (r) => r.status === 200 });
    }

    logout(authData);
    return created;
  });
}

// Setup function - runs once before test
export function setup() {
  console.log('User Journeys test starting...');
  console.log(`Target: ${ENV.BASE_URL}`);

  // Verify the server is up
  const res = http.get(ENV.BASE_URL);
  if (res.status !== 200) {
    console.error(`Server not responding properly: ${res.status}`);
  }

  return { startTime: Date.now() };
}

// Teardown function - runs once after test
export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`User Journeys test completed in ${duration}ms`);
}
