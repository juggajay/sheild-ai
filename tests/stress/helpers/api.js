/**
 * API Request Helpers
 * Common API operations for stress testing
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { ENV } from '../config.js';
import { authParams } from './auth.js';

// Custom metrics
export const apiErrors = new Counter('api_errors');
export const apiDuration = new Trend('api_duration');

/**
 * Make authenticated GET request
 */
export function apiGet(path, authData, tags = {}) {
  const url = `${ENV.API_URL}${path}`;
  const params = authParams(authData, {}, { type: 'api', ...tags });

  const response = http.get(url, params);
  apiDuration.add(response.timings.duration);

  if (response.status >= 400) {
    apiErrors.add(1);
  }

  return response;
}

/**
 * Make authenticated POST request
 */
export function apiPost(path, data, authData, tags = {}) {
  const url = `${ENV.API_URL}${path}`;
  const params = authParams(authData, {}, { type: 'api', ...tags });
  const payload = typeof data === 'string' ? data : JSON.stringify(data);

  const response = http.post(url, payload, params);
  apiDuration.add(response.timings.duration);

  if (response.status >= 400) {
    apiErrors.add(1);
  }

  return response;
}

/**
 * Make authenticated PUT request
 */
export function apiPut(path, data, authData, tags = {}) {
  const url = `${ENV.API_URL}${path}`;
  const params = authParams(authData, {}, { type: 'api', ...tags });
  const payload = typeof data === 'string' ? data : JSON.stringify(data);

  const response = http.put(url, payload, params);
  apiDuration.add(response.timings.duration);

  if (response.status >= 400) {
    apiErrors.add(1);
  }

  return response;
}

/**
 * Make authenticated DELETE request
 */
export function apiDelete(path, authData, tags = {}) {
  const url = `${ENV.API_URL}${path}`;
  const params = authParams(authData, {}, { type: 'api', ...tags });

  const response = http.del(url, null, params);
  apiDuration.add(response.timings.duration);

  if (response.status >= 400) {
    apiErrors.add(1);
  }

  return response;
}

/**
 * Upload file via multipart form
 */
export function apiUpload(path, fileData, fileName, authData, additionalFields = {}, tags = {}) {
  const url = `${ENV.API_URL}${path}`;

  const formData = {
    file: http.file(fileData, fileName, 'application/pdf'),
    ...additionalFields,
  };

  const params = {
    headers: authData ? { ...authData.headers } : {},
    cookies: authData ? authData.cookies : {},
    tags: { type: 'upload', ...tags },
  };

  // Remove Content-Type header - let k6 set multipart boundary
  delete params.headers['Content-Type'];

  const response = http.post(url, formData, params);
  apiDuration.add(response.timings.duration);

  if (response.status >= 400) {
    apiErrors.add(1);
  }

  return response;
}

/**
 * Parse JSON response safely
 */
export function parseResponse(response) {
  try {
    return JSON.parse(response.body);
  } catch {
    return null;
  }
}

/**
 * Check response status and return parsed body
 */
export function expectSuccess(response, expectedStatus = 200) {
  const success = check(response, {
    [`status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
  });

  if (!success) {
    console.error(`Request failed: ${response.status} - ${response.body}`);
  }

  return success ? parseResponse(response) : null;
}

/**
 * Project API operations
 */
export const projectsApi = {
  list: (authData, params = '') => apiGet(`/projects${params}`, authData, { endpoint: 'projects_list' }),
  get: (authData, id) => apiGet(`/projects/${id}`, authData, { endpoint: 'projects_get' }),
  create: (authData, data) => apiPost('/projects', data, authData, { endpoint: 'projects_create' }),
  update: (authData, id, data) => apiPut(`/projects/${id}`, data, authData, { endpoint: 'projects_update' }),
  delete: (authData, id) => apiDelete(`/projects/${id}`, authData, { endpoint: 'projects_delete' }),
  getRequirements: (authData, id) => apiGet(`/projects/${id}/requirements`, authData, { endpoint: 'requirements_get' }),
  setRequirements: (authData, id, data) => apiPost(`/projects/${id}/requirements`, data, authData, { endpoint: 'requirements_set' }),
  getSubcontractors: (authData, id) => apiGet(`/projects/${id}/subcontractors`, authData, { endpoint: 'project_subs_get' }),
  assignSubcontractor: (authData, id, data) => apiPost(`/projects/${id}/subcontractors`, data, authData, { endpoint: 'project_subs_assign' }),
  getReport: (authData, id) => apiGet(`/projects/${id}/report`, authData, { endpoint: 'project_report' }),
};

/**
 * Subcontractor API operations
 */
export const subcontractorsApi = {
  list: (authData, params = '') => apiGet(`/subcontractors${params}`, authData, { endpoint: 'subs_list' }),
  get: (authData, id) => apiGet(`/subcontractors/${id}`, authData, { endpoint: 'subs_get' }),
  create: (authData, data) => apiPost('/subcontractors', data, authData, { endpoint: 'subs_create' }),
  update: (authData, id, data) => apiPut(`/subcontractors/${id}`, data, authData, { endpoint: 'subs_update' }),
  delete: (authData, id) => apiDelete(`/subcontractors/${id}`, authData, { endpoint: 'subs_delete' }),
  import: (authData, csvData) => apiUpload('/subcontractors/import', csvData, 'import.csv', authData, {}, { endpoint: 'subs_import' }),
};

/**
 * Document API operations
 */
export const documentsApi = {
  list: (authData, params = '') => apiGet(`/documents${params}`, authData, { endpoint: 'docs_list' }),
  get: (authData, id) => apiGet(`/documents/${id}`, authData, { endpoint: 'docs_get' }),
  upload: (authData, fileData, fileName, metadata = {}) =>
    apiUpload('/documents', fileData, fileName, authData, metadata, { endpoint: 'docs_upload' }),
  verify: (authData, id) => apiPost(`/documents/${id}/verify`, {}, authData, { endpoint: 'docs_verify' }),
  process: (authData, id) => apiPost(`/documents/${id}/process`, {}, authData, { endpoint: 'docs_process' }),
  download: (authData, id) => apiGet(`/documents/${id}/download`, authData, { endpoint: 'docs_download' }),
  delete: (authData, id) => apiDelete(`/documents/${id}`, authData, { endpoint: 'docs_delete' }),
};

/**
 * Exception API operations
 */
export const exceptionsApi = {
  list: (authData, params = '') => apiGet(`/exceptions${params}`, authData, { endpoint: 'exceptions_list' }),
  get: (authData, id) => apiGet(`/exceptions/${id}`, authData, { endpoint: 'exceptions_get' }),
  create: (authData, data) => apiPost('/exceptions', data, authData, { endpoint: 'exceptions_create' }),
  update: (authData, id, data) => apiPut(`/exceptions/${id}`, data, authData, { endpoint: 'exceptions_update' }),
  delete: (authData, id) => apiDelete(`/exceptions/${id}`, authData, { endpoint: 'exceptions_delete' }),
  getAuditTrail: (authData, id) => apiGet(`/exceptions/${id}/audit-trail`, authData, { endpoint: 'exceptions_audit' }),
};

/**
 * Communication API operations
 */
export const communicationsApi = {
  list: (authData, params = '') => apiGet(`/communications${params}`, authData, { endpoint: 'comms_list' }),
  create: (authData, data) => apiPost('/communications', data, authData, { endpoint: 'comms_create' }),
  triggerFollowups: (authData) => apiPost('/communications/trigger-followups', {}, authData, { endpoint: 'comms_followup' }),
  resend: (authData, data) => apiPost('/communications/resend', data, authData, { endpoint: 'comms_resend' }),
};

/**
 * User API operations
 */
export const usersApi = {
  list: (authData, params = '') => apiGet(`/users${params}`, authData, { endpoint: 'users_list' }),
  get: (authData, id) => apiGet(`/users/${id}`, authData, { endpoint: 'users_get' }),
  create: (authData, data) => apiPost('/users', data, authData, { endpoint: 'users_create' }),
  update: (authData, id, data) => apiPut(`/users/${id}`, data, authData, { endpoint: 'users_update' }),
  delete: (authData, id) => apiDelete(`/users/${id}`, authData, { endpoint: 'users_delete' }),
  invite: (authData, data) => apiPost('/users/invite', data, authData, { endpoint: 'users_invite' }),
  getProfile: (authData) => apiGet('/user/profile', authData, { endpoint: 'user_profile' }),
  updateProfile: (authData, data) => apiPut('/user/profile', data, authData, { endpoint: 'user_profile_update' }),
  getPreferences: (authData) => apiGet('/user/preferences', authData, { endpoint: 'user_prefs' }),
  updatePreferences: (authData, data) => apiPut('/user/preferences', data, authData, { endpoint: 'user_prefs_update' }),
};

/**
 * Dashboard/Monitoring API operations
 */
export const dashboardApi = {
  getNotifications: (authData) => apiGet('/notifications', authData, { endpoint: 'notifications' }),
  getExpirations: (authData) => apiGet('/expirations', authData, { endpoint: 'expirations' }),
  getCriticalAlerts: (authData) => apiGet('/alerts/critical', authData, { endpoint: 'critical_alerts' }),
  getMonitoringExpirations: (authData) => apiGet('/monitoring/expirations', authData, { endpoint: 'monitoring_exp' }),
  getComplianceHistory: (authData) => apiGet('/compliance-history', authData, { endpoint: 'compliance_history' }),
  getMorningBrief: (authData) => apiGet('/morning-brief', authData, { endpoint: 'morning_brief' }),
  getAuditLogs: (authData, params = '') => apiGet(`/audit-logs${params}`, authData, { endpoint: 'audit_logs' }),
};

/**
 * Company API operations
 */
export const companyApi = {
  get: (authData) => apiGet('/company', authData, { endpoint: 'company_get' }),
  update: (authData, data) => apiPut('/company', data, authData, { endpoint: 'company_update' }),
};

/**
 * Integration API operations
 */
export const integrationsApi = {
  getStatus: (authData) => apiGet('/integrations/status', authData, { endpoint: 'integrations_status' }),
  testSendGrid: (authData) => apiPost('/integrations/test/sendgrid', {}, authData, { endpoint: 'test_sendgrid' }),
  testTwilio: (authData) => apiPost('/integrations/test/twilio', {}, authData, { endpoint: 'test_twilio' }),
};

/**
 * Stripe API operations
 */
export const stripeApi = {
  createCheckoutSession: (authData, data) => apiPost('/stripe/create-checkout-session', data, authData, { endpoint: 'stripe_checkout' }),
  createPortalSession: (authData) => apiPost('/stripe/create-portal-session', {}, authData, { endpoint: 'stripe_portal' }),
  getSubscription: (authData) => apiGet('/stripe/subscription', authData, { endpoint: 'stripe_subscription' }),
};

/**
 * External API operations
 */
export const externalApi = {
  validateABN: (authData, abn) => apiGet(`/external/abn/${abn}`, authData, { endpoint: 'abn_validate' }),
};

/**
 * Requirement templates API
 */
export const templatesApi = {
  list: (authData) => apiGet('/requirement-templates', authData, { endpoint: 'templates_list' }),
  create: (authData, data) => apiPost('/requirement-templates', data, authData, { endpoint: 'templates_create' }),
};

/**
 * Email templates API
 */
export const emailTemplatesApi = {
  list: (authData) => apiGet('/email-templates', authData, { endpoint: 'email_templates_list' }),
  create: (authData, data) => apiPost('/email-templates', data, authData, { endpoint: 'email_templates_create' }),
};
