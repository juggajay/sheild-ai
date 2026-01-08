/**
 * Authentication Helpers for k6 Tests
 * Handles login, session management, and token handling
 */

import http from 'k6/http';
import { check, fail } from 'k6';
import { Rate } from 'k6/metrics';
import { ENV, getUserFromPool } from '../config.js';

// Custom metrics
export const loginSuccess = new Rate('login_success');

/**
 * Login and get authentication token/cookies
 * Uses user pool rotation when usePool=true to distribute load
 * @param {string} email - User email (optional if using pool)
 * @param {string} password - User password (optional if using pool)
 * @param {boolean} usePool - Whether to use user pool rotation (default: true)
 * @returns {object} - Auth headers and cookies
 */
export function login(email = null, password = null, usePool = true) {
  // Use user pool if no credentials specified
  if (usePool && !email) {
    const user = getUserFromPool(__VU || 0);
    email = user.email;
    password = user.password;
  } else if (!email) {
    email = ENV.ADMIN_EMAIL;
    password = ENV.ADMIN_PASSWORD;
  }
  const url = `${ENV.API_URL}/auth/login`;

  const payload = JSON.stringify({
    email: email,
    password: password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { type: 'auth' },
  };

  const response = http.post(url, payload, params);

  const success = check(response, {
    'login status is 200': (r) => r.status === 200,
    'login has token or session': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token || body.user || r.cookies['session'];
      } catch {
        return false;
      }
    },
  });

  loginSuccess.add(success);

  if (!success) {
    console.error(`Login failed for ${email}: ${response.status} - ${response.body}`);
    return null;
  }

  // Extract auth info
  let authData = {
    headers: {
      'Content-Type': 'application/json',
    },
    cookies: {},
  };

  // Handle JWT token in response
  try {
    const body = JSON.parse(response.body);
    if (body.token) {
      authData.headers['Authorization'] = `Bearer ${body.token}`;
    }
  } catch {
    // No JSON body
  }

  // Handle session cookies
  if (response.cookies) {
    for (const [name, cookies] of Object.entries(response.cookies)) {
      if (cookies.length > 0) {
        authData.cookies[name] = cookies[0].value;
      }
    }
  }

  return authData;
}

/**
 * Signup a new user
 * @param {object} userData - User data
 * @returns {object} - Auth headers and cookies
 */
export function signup(userData) {
  const url = `${ENV.API_URL}/auth/signup`;

  const defaultData = {
    email: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@test.com`,
    password: 'TestPassword123!',
    name: 'Test User',
    company_name: 'Test Company',
  };

  const payload = JSON.stringify({ ...defaultData, ...userData });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { type: 'auth' },
  };

  const response = http.post(url, payload, params);

  const success = check(response, {
    'signup status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });

  if (!success) {
    console.error(`Signup failed: ${response.status} - ${response.body}`);
    return null;
  }

  // Return auth data from signup response
  let authData = {
    headers: {
      'Content-Type': 'application/json',
    },
    cookies: {},
  };

  try {
    const body = JSON.parse(response.body);
    if (body.token) {
      authData.headers['Authorization'] = `Bearer ${body.token}`;
    }
    authData.user = body.user;
  } catch {
    // No JSON body
  }

  if (response.cookies) {
    for (const [name, cookies] of Object.entries(response.cookies)) {
      if (cookies.length > 0) {
        authData.cookies[name] = cookies[0].value;
      }
    }
  }

  return authData;
}

/**
 * Logout user
 * @param {object} authData - Authentication data from login
 */
export function logout(authData) {
  if (!authData) return;

  const url = `${ENV.API_URL}/auth/logout`;

  const params = {
    headers: authData.headers,
    cookies: authData.cookies,
    tags: { type: 'auth' },
  };

  const response = http.post(url, null, params);

  check(response, {
    'logout successful': (r) => r.status === 200 || r.status === 204,
  });
}

/**
 * Get current user info
 * @param {object} authData - Authentication data
 * @returns {object} - User data
 */
export function getCurrentUser(authData) {
  if (!authData) return null;

  const url = `${ENV.API_URL}/auth/me`;

  const params = {
    headers: authData.headers,
    cookies: authData.cookies,
    tags: { type: 'auth' },
  };

  const response = http.get(url, params);

  if (response.status === 200) {
    try {
      return JSON.parse(response.body);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Request password reset
 * @param {string} email - User email
 */
export function requestPasswordReset(email) {
  const url = `${ENV.API_URL}/auth/forgot-password`;

  const payload = JSON.stringify({ email });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { type: 'auth' },
  };

  const response = http.post(url, payload, params);

  return check(response, {
    'password reset requested': (r) => r.status === 200,
  });
}

/**
 * Generate magic link token for portal access
 * @param {string} email - Subcontractor email
 * @returns {object} - Response with token info
 */
export function requestMagicLink(email) {
  const url = `${ENV.API_URL}/portal/auth/magic-link`;

  const payload = JSON.stringify({ email });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { type: 'auth' },
  };

  const response = http.post(url, payload, params);

  check(response, {
    'magic link sent': (r) => r.status === 200,
  });

  try {
    return JSON.parse(response.body);
  } catch {
    return null;
  }
}

/**
 * Verify magic link token
 * @param {string} token - Magic link token
 * @returns {object} - Auth data for portal
 */
export function verifyMagicLink(token) {
  const url = `${ENV.API_URL}/portal/auth/verify`;

  const payload = JSON.stringify({ token });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { type: 'auth' },
  };

  const response = http.post(url, payload, params);

  if (response.status === 200) {
    let authData = {
      headers: {
        'Content-Type': 'application/json',
      },
      cookies: {},
    };

    try {
      const body = JSON.parse(response.body);
      if (body.token) {
        authData.headers['Authorization'] = `Bearer ${body.token}`;
      }
    } catch {
      // No JSON body
    }

    if (response.cookies) {
      for (const [name, cookies] of Object.entries(response.cookies)) {
        if (cookies.length > 0) {
          authData.cookies[name] = cookies[0].value;
        }
      }
    }

    return authData;
  }

  return null;
}

/**
 * Create authenticated request params
 * @param {object} authData - Authentication data
 * @param {object} additionalHeaders - Additional headers to include
 * @param {object} tags - Request tags
 * @returns {object} - Request params
 */
export function authParams(authData, additionalHeaders = {}, tags = {}) {
  if (!authData) {
    return {
      headers: {
        'Content-Type': 'application/json',
        ...additionalHeaders,
      },
      tags,
    };
  }

  return {
    headers: {
      ...authData.headers,
      ...additionalHeaders,
    },
    cookies: authData.cookies,
    tags,
  };
}
