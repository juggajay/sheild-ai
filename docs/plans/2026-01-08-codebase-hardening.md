# RiskShield AI Codebase Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all critical and important issues identified in the code review to make RiskShield AI production-ready.

**Architecture:** We will add a centralized middleware layer for authentication, implement comprehensive testing with Jest/Playwright, add security hardening (rate limiting, proper secrets handling), improve performance with caching and pagination, and add error boundaries for resilience.

**Tech Stack:** Next.js 14 middleware, Jest + React Testing Library, Playwright E2E, next-rate-limit, React Error Boundaries, React Query caching

---

## Phase 1: Critical Security Fixes

### Task 1: Remove Hardcoded JWT Secret Fallback

**Files:**
- Modify: `lib/auth.ts:6`
- Create: `.env.example`
- Modify: `README.md`

**Step 1: Read current auth.ts implementation**

Review the current JWT_SECRET handling to understand the context.

**Step 2: Fix the JWT secret handling**

```typescript
// lib/auth.ts - Replace line 6
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production')
  }
  console.warn('WARNING: JWT_SECRET not set. Using insecure development secret.')
}

const getJwtSecret = (): string => {
  if (JWT_SECRET) return JWT_SECRET
  if (process.env.NODE_ENV !== 'production') {
    return 'riskshield-development-secret-key-DO-NOT-USE-IN-PRODUCTION'
  }
  throw new Error('JWT_SECRET must be set')
}
```

**Step 3: Update all JWT sign/verify calls to use getJwtSecret()**

Find and replace all usages of `JWT_SECRET` with `getJwtSecret()`.

**Step 4: Create .env.example file**

```bash
# .env.example
# Required in production
JWT_SECRET=your-secure-random-secret-min-32-chars

# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Convex (required)
NEXT_PUBLIC_CONVEX_URL=

# OpenAI (required for AI verification)
OPENAI_API_KEY=

# Email - SendGrid (optional, enables email notifications)
SENDGRID_API_KEY=

# SMS - Twilio (optional, enables SMS notifications)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

**Step 5: Commit**

```bash
git add lib/auth.ts .env.example
git commit -m "security: remove hardcoded JWT secret fallback, add env example"
```

---

### Task 2: Add Next.js Authentication Middleware

**Files:**
- Create: `middleware.ts`
- Create: `lib/middleware-auth.ts`

**Step 1: Create the middleware auth helper**

```typescript
// lib/middleware-auth.ts
import { NextRequest } from 'next/server'
import * as jose from 'jose'

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/portal/login',
  '/portal/verify',
]

const API_PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/portal/auth/magic-link',
  '/api/portal/auth/verify',
  '/api/broker/auth/magic-link',
  '/api/broker/auth/verify',
  '/api/webhooks/sendgrid',
]

export function isPublicPath(pathname: string): boolean {
  // Check exact matches
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (API_PUBLIC_PATHS.includes(pathname)) return true

  // Check if it's a static file or Next.js internal route
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/favicon')) return true
  if (pathname.includes('.')) return true // Static files

  return false
}

export function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

export function isPortalRoute(pathname: string): boolean {
  return pathname.startsWith('/portal/')
}

export function isDashboardRoute(pathname: string): boolean {
  return pathname.startsWith('/dashboard')
}

export async function verifyTokenFromRequest(request: NextRequest): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    return { valid: false, error: 'No token provided' }
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret')
    const { payload } = await jose.jwtVerify(token, secret)
    return { valid: true, userId: payload.userId as string }
  } catch (error) {
    return { valid: false, error: 'Invalid or expired token' }
  }
}
```

**Step 2: Create the main middleware file**

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isPublicPath, isApiRoute, isDashboardRoute, isPortalRoute, verifyTokenFromRequest } from './lib/middleware-auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Check authentication
  const { valid, error } = await verifyTokenFromRequest(request)

  // Handle unauthenticated requests
  if (!valid) {
    // API routes return 401
    if (isApiRoute(pathname)) {
      return NextResponse.json(
        { error: 'Not authenticated', details: error },
        { status: 401 }
      )
    }

    // Portal routes redirect to portal login
    if (isPortalRoute(pathname)) {
      const loginUrl = new URL('/portal/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Dashboard routes redirect to main login
    if (isDashboardRoute(pathname)) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
```

**Step 3: Test middleware manually**

1. Start dev server: `npm run dev`
2. Clear cookies and try accessing `/dashboard` - should redirect to `/login`
3. Login and verify `/dashboard` is accessible
4. Test API route without token returns 401

**Step 4: Commit**

```bash
git add middleware.ts lib/middleware-auth.ts
git commit -m "feat: add Next.js middleware for centralized authentication"
```

---

### Task 3: Add Rate Limiting to Auth Endpoints

**Files:**
- Create: `lib/rate-limit.ts`
- Modify: `app/api/auth/login/route.ts`
- Modify: `app/api/auth/signup/route.ts`
- Modify: `app/api/auth/forgot-password/route.ts`

**Step 1: Install rate limiting package**

```bash
npm install lru-cache
```

**Step 2: Create rate limiting utility**

```typescript
// lib/rate-limit.ts
import { LRUCache } from 'lru-cache'
import { NextRequest, NextResponse } from 'next/server'

type RateLimitOptions = {
  interval: number // Time window in milliseconds
  uniqueTokenPerInterval: number // Max users per interval
  limit: number // Max requests per user per interval
}

type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

const rateLimiters = new Map<string, LRUCache<string, number[]>>()

function getRateLimiter(name: string, options: RateLimitOptions): LRUCache<string, number[]> {
  if (!rateLimiters.has(name)) {
    rateLimiters.set(name, new LRUCache<string, number[]>({
      max: options.uniqueTokenPerInterval,
      ttl: options.interval,
    }))
  }
  return rateLimiters.get(name)!
}

export function rateLimit(options: RateLimitOptions) {
  const { interval, limit } = options

  return {
    check: (request: NextRequest, name: string): RateLimitResult => {
      const limiter = getRateLimiter(name, options)

      // Use IP address as identifier
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                 request.headers.get('x-real-ip') ||
                 'anonymous'

      const now = Date.now()
      const windowStart = now - interval

      // Get existing timestamps for this IP
      const timestamps = limiter.get(ip) || []

      // Filter to only include timestamps within the current window
      const validTimestamps = timestamps.filter(ts => ts > windowStart)

      if (validTimestamps.length >= limit) {
        return {
          success: false,
          limit,
          remaining: 0,
          reset: Math.ceil((validTimestamps[0] + interval - now) / 1000)
        }
      }

      // Add current timestamp
      validTimestamps.push(now)
      limiter.set(ip, validTimestamps)

      return {
        success: true,
        limit,
        remaining: limit - validTimestamps.length,
        reset: Math.ceil(interval / 1000)
      }
    }
  }
}

// Pre-configured limiters
export const authLimiter = rateLimit({
  interval: 15 * 60 * 1000, // 15 minutes
  uniqueTokenPerInterval: 500,
  limit: 5, // 5 attempts per 15 minutes
})

export const apiLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 1000,
  limit: 60, // 60 requests per minute
})

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests',
      retryAfter: result.reset
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toString(),
        'Retry-After': result.reset.toString(),
      }
    }
  )
}
```

**Step 3: Apply rate limiting to login route**

Add at the top of the POST handler in `app/api/auth/login/route.ts`:

```typescript
import { authLimiter, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateLimitResult = authLimiter.check(request, 'login')
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult)
  }

  // ... rest of existing code
}
```

**Step 4: Apply rate limiting to signup route**

Add same pattern to `app/api/auth/signup/route.ts`.

**Step 5: Apply rate limiting to forgot-password route**

Add same pattern to `app/api/auth/forgot-password/route.ts`.

**Step 6: Test rate limiting**

```bash
# Run this loop to test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
done
```

After 5 attempts, should receive 429 status.

**Step 7: Commit**

```bash
git add lib/rate-limit.ts app/api/auth/login/route.ts app/api/auth/signup/route.ts app/api/auth/forgot-password/route.ts
git commit -m "security: add rate limiting to authentication endpoints"
```

---

## Phase 2: Testing Infrastructure

### Task 4: Set Up Jest Testing Framework

**Files:**
- Create: `jest.config.js`
- Create: `jest.setup.js`
- Modify: `package.json`
- Create: `__tests__/lib/utils.test.ts`

**Step 1: Install Jest and testing dependencies**

```bash
npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

**Step 2: Create Jest configuration**

```javascript
// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
}

module.exports = createJestConfig(customJestConfig)
```

**Step 3: Create Jest setup file**

```javascript
// jest.setup.js
import '@testing-library/jest-dom'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '',
}))

// Mock cookies
jest.mock('next/headers', () => ({
  cookies: () => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  }),
}))
```

**Step 4: Add test scripts to package.json**

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**Step 5: Create first test file for utils**

```typescript
// __tests__/lib/utils.test.ts
import { cn, formatDate, formatCurrency } from '@/lib/utils'

describe('cn (className utility)', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('handles undefined values', () => {
    expect(cn('base', undefined, 'end')).toBe('base end')
  })
})

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2024-01-15')
    expect(result).toContain('2024')
  })

  it('handles null/undefined', () => {
    expect(formatDate(null as any)).toBe('')
    expect(formatDate(undefined as any)).toBe('')
  })
})

describe('formatCurrency', () => {
  it('formats AUD currency', () => {
    const result = formatCurrency(1000)
    expect(result).toContain('1,000')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toContain('0')
  })
})
```

**Step 6: Run tests to verify setup**

```bash
npm test
```

Expected: Tests pass (or fail gracefully if utils don't exist yet).

**Step 7: Commit**

```bash
git add jest.config.js jest.setup.js package.json __tests__/
git commit -m "test: set up Jest testing framework with initial utils tests"
```

---

### Task 5: Add Tests for Fraud Detection Module

**Files:**
- Create: `__tests__/lib/fraud-detection.test.ts`

**Step 1: Write comprehensive tests for ABN validation**

```typescript
// __tests__/lib/fraud-detection.test.ts
import {
  validateABNChecksum,
  performFraudAnalysis,
  checkPolicyNumberFormat,
  checkDateLogic
} from '@/lib/fraud-detection'

describe('validateABNChecksum', () => {
  describe('valid ABNs', () => {
    it('validates correct ABN: 51 824 753 556', () => {
      const result = validateABNChecksum('51824753556')
      expect(result.valid).toBe(true)
    })

    it('validates ABN with spaces: 51 824 753 556', () => {
      const result = validateABNChecksum('51 824 753 556')
      expect(result.valid).toBe(true)
    })

    it('validates ABN with dashes', () => {
      const result = validateABNChecksum('51-824-753-556')
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid ABNs', () => {
    it('rejects ABN with wrong checksum', () => {
      const result = validateABNChecksum('51824753557')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('checksum')
    })

    it('rejects ABN with wrong length', () => {
      const result = validateABNChecksum('5182475355')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('11 digits')
    })

    it('rejects ABN with non-numeric characters', () => {
      const result = validateABNChecksum('51824753ABC')
      expect(result.valid).toBe(false)
    })

    it('rejects empty string', () => {
      const result = validateABNChecksum('')
      expect(result.valid).toBe(false)
    })
  })
})

describe('checkPolicyNumberFormat', () => {
  it('validates standard policy number format', () => {
    const result = checkPolicyNumberFormat('POL-2024-12345', 'Generic')
    expect(result.status).toBe('pass')
  })

  it('flags suspicious policy numbers', () => {
    const result = checkPolicyNumberFormat('TEST123', 'Generic')
    expect(result.status).toBe('warning')
  })

  it('flags obviously fake policy numbers', () => {
    const result = checkPolicyNumberFormat('12345', 'Generic')
    expect(result.status).toBe('warning')
  })
})

describe('checkDateLogic', () => {
  it('passes when expiry is after issue date', () => {
    const result = checkDateLogic({
      issueDate: '2024-01-01',
      expiryDate: '2025-01-01'
    })
    expect(result.status).toBe('pass')
  })

  it('fails when expiry is before issue date', () => {
    const result = checkDateLogic({
      issueDate: '2025-01-01',
      expiryDate: '2024-01-01'
    })
    expect(result.status).toBe('fail')
  })

  it('warns on very long policy period', () => {
    const result = checkDateLogic({
      issueDate: '2024-01-01',
      expiryDate: '2030-01-01'
    })
    expect(result.status).toBe('warning')
  })
})

describe('performFraudAnalysis', () => {
  it('returns array of fraud check results', async () => {
    const mockDocument = {
      abn: '51824753556',
      policyNumber: 'POL-2024-12345',
      insurer: 'QBE',
      issueDate: '2024-01-01',
      expiryDate: '2025-01-01',
    }

    const results = await performFraudAnalysis(mockDocument)

    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
    results.forEach(result => {
      expect(result).toHaveProperty('check_type')
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('risk_score')
    })
  })
})
```

**Step 2: Run fraud detection tests**

```bash
npm test -- --testPathPattern=fraud-detection
```

**Step 3: Commit**

```bash
git add __tests__/lib/fraud-detection.test.ts
git commit -m "test: add comprehensive tests for fraud detection module"
```

---

### Task 6: Add Tests for Authentication Module

**Files:**
- Create: `__tests__/lib/auth.test.ts`

**Step 1: Write auth module tests**

```typescript
// __tests__/lib/auth.test.ts
import {
  hashPassword,
  verifyPassword,
  validatePasswordRequirements,
  createToken,
  verifyToken
} from '@/lib/auth'

describe('Password Hashing', () => {
  describe('hashPassword', () => {
    it('returns a hash different from input', async () => {
      const password = 'TestPassword123'
      const hash = await hashPassword(password)

      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(50)
    })

    it('generates different hashes for same password', async () => {
      const password = 'TestPassword123'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyPassword', () => {
    it('returns true for correct password', async () => {
      const password = 'TestPassword123'
      const hash = await hashPassword(password)

      const result = await verifyPassword(password, hash)
      expect(result).toBe(true)
    })

    it('returns false for incorrect password', async () => {
      const password = 'TestPassword123'
      const hash = await hashPassword(password)

      const result = await verifyPassword('WrongPassword', hash)
      expect(result).toBe(false)
    })
  })
})

describe('Password Validation', () => {
  describe('validatePasswordRequirements', () => {
    it('passes for valid password', () => {
      const result = validatePasswordRequirements('ValidPass123')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('fails for password too short', () => {
      const result = validatePasswordRequirements('Short1')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('8 characters'))
    })

    it('fails for password without uppercase', () => {
      const result = validatePasswordRequirements('lowercase123')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('uppercase'))
    })

    it('fails for password without lowercase', () => {
      const result = validatePasswordRequirements('UPPERCASE123')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('lowercase'))
    })

    it('fails for password without number', () => {
      const result = validatePasswordRequirements('NoNumbersHere')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('number'))
    })
  })
})

describe('JWT Tokens', () => {
  const mockPayload = { userId: '123', email: 'test@example.com' }

  describe('createToken', () => {
    it('creates a valid JWT string', () => {
      const token = createToken(mockPayload)

      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })
  })

  describe('verifyToken', () => {
    it('verifies and decodes a valid token', () => {
      const token = createToken(mockPayload)
      const decoded = verifyToken(token)

      expect(decoded.userId).toBe(mockPayload.userId)
      expect(decoded.email).toBe(mockPayload.email)
    })

    it('throws for invalid token', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow()
    })

    it('throws for tampered token', () => {
      const token = createToken(mockPayload)
      const tamperedToken = token.slice(0, -5) + 'XXXXX'

      expect(() => verifyToken(tamperedToken)).toThrow()
    })
  })
})
```

**Step 2: Run auth tests**

```bash
npm test -- --testPathPattern=auth
```

**Step 3: Commit**

```bash
git add __tests__/lib/auth.test.ts
git commit -m "test: add comprehensive tests for authentication module"
```

---

### Task 7: Set Up Playwright E2E Tests

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/auth.spec.ts`
- Modify: `package.json`

**Step 1: Install Playwright**

```bash
npm install --save-dev @playwright/test
npx playwright install
```

**Step 2: Create Playwright configuration**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

**Step 3: Create E2E auth tests**

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows validation errors for invalid login', async ({ page }) => {
    await page.goto('/login')

    // Submit empty form
    await page.click('button[type="submit"]')

    // Should show validation errors
    await expect(page.locator('text=required')).toBeVisible()
  })

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'wrong@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 5000 })
  })

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/login')

    // Use test credentials (should exist in seeded data)
    await page.fill('input[name="email"]', 'admin@test.com')
    await page.fill('input[name="password"]', 'Password123')
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test('logout clears session', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[name="email"]', 'admin@test.com')
    await page.fill('input[name="password"]', 'Password123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Find and click logout
    await page.click('button:has-text("Logout")')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)

    // Trying to access dashboard should redirect
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Rate Limiting', () => {
  test('blocks after too many failed login attempts', async ({ page }) => {
    await page.goto('/login')

    // Attempt login 6 times (limit is 5)
    for (let i = 0; i < 6; i++) {
      await page.fill('input[name="email"]', 'test@example.com')
      await page.fill('input[name="password"]', 'wrongpassword')
      await page.click('button[type="submit"]')
      await page.waitForTimeout(500)
    }

    // Should show rate limit message
    await expect(page.locator('text=Too many')).toBeVisible({ timeout: 5000 })
  })
})
```

**Step 4: Add E2E test script to package.json**

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**Step 5: Run E2E tests**

```bash
npm run test:e2e
```

**Step 6: Commit**

```bash
git add playwright.config.ts e2e/ package.json
git commit -m "test: add Playwright E2E tests for authentication flow"
```

---

## Phase 3: Error Handling & Resilience

### Task 8: Add React Error Boundaries

**Files:**
- Create: `components/error-boundary.tsx`
- Modify: `app/dashboard/layout.tsx`
- Create: `app/dashboard/error.tsx`
- Create: `app/global-error.tsx`

**Step 1: Create reusable Error Boundary component**

```typescript
// components/error-boundary.tsx
'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // TODO: Send to error tracking service (e.g., Sentry)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="flex items-center gap-2 text-destructive mb-4">
            <AlertTriangle className="h-8 w-8" />
            <h2 className="text-xl font-semibold">Something went wrong</h2>
          </div>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
          <div className="flex gap-4">
            <Button onClick={this.handleReset} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={() => window.location.href = '/dashboard'}>
              Go to Dashboard
            </Button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-8 p-4 bg-muted rounded-lg text-xs max-w-2xl overflow-auto">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
```

**Step 2: Create Next.js error page for dashboard**

```typescript
// app/dashboard/error.tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to error tracking service
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] p-8">
      <div className="flex items-center gap-2 text-destructive mb-4">
        <AlertTriangle className="h-10 w-10" />
        <h1 className="text-2xl font-bold">Dashboard Error</h1>
      </div>
      <p className="text-muted-foreground mb-2 text-center max-w-md">
        We encountered an error loading this page.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-6">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-4">
        <Button onClick={reset} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
        <Button onClick={() => window.location.href = '/dashboard'}>
          <Home className="mr-2 h-4 w-4" />
          Dashboard Home
        </Button>
      </div>
    </div>
  )
}
```

**Step 3: Create global error handler**

```typescript
// app/global-error.tsx
'use client'

import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex items-center gap-2 text-red-600 mb-4">
            <AlertTriangle className="h-12 w-12" />
            <h1 className="text-3xl font-bold">Application Error</h1>
          </div>
          <p className="text-gray-600 mb-6 text-center max-w-md">
            A critical error occurred. Please refresh the page or try again later.
          </p>
          <Button onClick={reset} size="lg">
            <RefreshCw className="mr-2 h-5 w-5" />
            Refresh Application
          </Button>
        </div>
      </body>
    </html>
  )
}
```

**Step 4: Wrap dashboard layout with ErrorBoundary**

In `app/dashboard/layout.tsx`, wrap the children with ErrorBoundary:

```typescript
import { ErrorBoundary } from '@/components/error-boundary'

// In the layout component, wrap children:
<ErrorBoundary>
  {children}
</ErrorBoundary>
```

**Step 5: Commit**

```bash
git add components/error-boundary.tsx app/dashboard/error.tsx app/global-error.tsx app/dashboard/layout.tsx
git commit -m "feat: add React error boundaries for graceful error handling"
```

---

## Phase 4: Performance Improvements

### Task 9: Add React Query Caching

**Files:**
- Create: `lib/query-client.ts`
- Create: `components/providers/query-provider.tsx`
- Modify: `app/layout.tsx`
- Create: `lib/hooks/use-projects.ts`

**Step 1: Create Query Client configuration**

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 1 minute
        staleTime: 60 * 1000,
        // Cache is kept for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Retry failed requests 3 times
        retry: 3,
        // Don't refetch on window focus in development
        refetchOnWindowFocus: process.env.NODE_ENV === 'production',
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}
```

**Step 2: Create Query Provider component**

```typescript
// components/providers/query-provider.tsx
'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { getQueryClient } from '@/lib/query-client'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
```

**Step 3: Create reusable hooks for data fetching**

```typescript
// lib/hooks/use-projects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
}

async function fetchProjects(filters?: Record<string, any>) {
  const params = new URLSearchParams(filters)
  const response = await fetch(`/api/projects?${params}`)
  if (!response.ok) throw new Error('Failed to fetch projects')
  return response.json()
}

async function fetchProject(id: string) {
  const response = await fetch(`/api/projects/${id}`)
  if (!response.ok) throw new Error('Failed to fetch project')
  return response.json()
}

async function createProject(data: any) {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Failed to create project')
  return response.json()
}

async function updateProject({ id, ...data }: any) {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Failed to update project')
  return response.json()
}

async function deleteProject(id: string) {
  const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to delete project')
  return response.json()
}

export function useProjects(filters?: Record<string, any>) {
  return useQuery({
    queryKey: projectKeys.list(filters || {}),
    queryFn: () => fetchProjects(filters),
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => fetchProject(id),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProject,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}
```

**Step 4: Install React Query Devtools**

```bash
npm install @tanstack/react-query-devtools
```

**Step 5: Add QueryProvider to root layout**

In `app/layout.tsx`, wrap with QueryProvider:

```typescript
import { QueryProvider } from '@/components/providers/query-provider'

// In the layout:
<QueryProvider>
  {children}
</QueryProvider>
```

**Step 6: Commit**

```bash
git add lib/query-client.ts components/providers/query-provider.tsx lib/hooks/use-projects.ts app/layout.tsx
git commit -m "feat: add React Query for data caching and optimistic updates"
```

---

### Task 10: Add Pagination to List Endpoints

**Files:**
- Modify: `app/api/projects/route.ts`
- Modify: `app/api/subcontractors/route.ts`
- Create: `lib/pagination.ts`

**Step 1: Create pagination utility**

```typescript
// lib/pagination.ts
export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit)

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  }
}
```

**Step 2: Update projects route with pagination**

In `app/api/projects/route.ts`, modify the GET handler:

```typescript
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination'

export async function GET(request: NextRequest) {
  // ... existing auth code ...

  const { searchParams } = new URL(request.url)
  const { page, limit, offset } = parsePaginationParams(searchParams)

  // Get total count
  const countResult = db.prepare(`
    SELECT COUNT(*) as total FROM projects
    WHERE company_id = ? AND status != 'deleted'
  `).get(user.company_id) as { total: number }

  // Get paginated data
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM project_subcontractors ps WHERE ps.project_id = p.id) as subcontractor_count
    FROM projects p
    WHERE p.company_id = ? AND p.status != 'deleted'
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(user.company_id, limit, offset)

  return NextResponse.json(createPaginatedResponse(projects, countResult.total, { page, limit, offset }))
}
```

**Step 3: Update subcontractors route with pagination**

Apply same pattern to `app/api/subcontractors/route.ts`.

**Step 4: Commit**

```bash
git add lib/pagination.ts app/api/projects/route.ts app/api/subcontractors/route.ts
git commit -m "feat: add pagination to list endpoints for better performance"
```

---

## Phase 5: Database Improvements

### Task 11: Create Proper Migration System

**Files:**
- Create: `lib/db/migrations/index.ts`
- Create: `lib/db/migrations/001_initial_schema.ts`
- Create: `lib/db/migrations/002_add_indexes.ts`
- Modify: `lib/db/index.ts`

**Step 1: Create migrations manager**

```typescript
// lib/db/migrations/index.ts
import Database from 'better-sqlite3'

export interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
  down: (db: Database.Database) => void
}

export function runMigrations(db: Database.Database, migrations: Migration[]) {
  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Get applied migrations
  const applied = db.prepare('SELECT version FROM _migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(m => m.version))

  // Run pending migrations in order
  const pending = migrations
    .filter(m => !appliedVersions.has(m.version))
    .sort((a, b) => a.version - b.version)

  for (const migration of pending) {
    console.log(`Running migration ${migration.version}: ${migration.name}`)

    const transaction = db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name)
    })

    try {
      transaction()
      console.log(`Migration ${migration.version} completed successfully`)
    } catch (error) {
      console.error(`Migration ${migration.version} failed:`, error)
      throw error
    }
  }

  return pending.length
}

export function rollbackMigration(db: Database.Database, migrations: Migration[]) {
  const lastApplied = db.prepare('SELECT version FROM _migrations ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined

  if (!lastApplied) {
    console.log('No migrations to rollback')
    return
  }

  const migration = migrations.find(m => m.version === lastApplied.version)
  if (!migration) {
    throw new Error(`Migration ${lastApplied.version} not found`)
  }

  console.log(`Rolling back migration ${migration.version}: ${migration.name}`)

  const transaction = db.transaction(() => {
    migration.down(db)
    db.prepare('DELETE FROM _migrations WHERE version = ?').run(migration.version)
  })

  transaction()
  console.log(`Rollback of migration ${migration.version} completed`)
}
```

**Step 2: Extract schema to migration file**

```typescript
// lib/db/migrations/001_initial_schema.ts
import { Migration } from './index'

export const migration: Migration = {
  version: 1,
  name: 'initial_schema',
  up: (db) => {
    // Companies
    db.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        abn TEXT UNIQUE,
        email TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        forwarding_email TEXT UNIQUE,
        subscription_tier TEXT DEFAULT 'starter',
        settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Users
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        company_id TEXT REFERENCES companies(id),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'risk_manager', 'project_manager', 'project_administrator', 'read_only', 'subcontractor', 'broker')),
        phone TEXT,
        notification_preferences TEXT DEFAULT '{}',
        invitation_status TEXT DEFAULT 'active',
        invitation_token TEXT,
        invitation_expires_at TEXT,
        last_login TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Sessions
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Projects
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        company_id TEXT REFERENCES companies(id),
        name TEXT NOT NULL,
        description TEXT,
        address TEXT,
        state TEXT CHECK (state IN ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT')),
        start_date TEXT,
        end_date TEXT,
        estimated_value REAL,
        project_manager_id TEXT REFERENCES users(id),
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'archived', 'deleted')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Continue with remaining tables...
    // (Subcontractors, Documents, Verifications, etc.)
  },
  down: (db) => {
    db.exec('DROP TABLE IF EXISTS projects')
    db.exec('DROP TABLE IF EXISTS sessions')
    db.exec('DROP TABLE IF EXISTS users')
    db.exec('DROP TABLE IF EXISTS companies')
  }
}
```

**Step 3: Create indexes migration**

```typescript
// lib/db/migrations/002_add_indexes.ts
import { Migration } from './index'

export const migration: Migration = {
  version: 2,
  name: 'add_indexes',
  up: (db) => {
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_subcontractors_company ON subcontractors(company_id)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_subcontractors_abn ON subcontractors(abn)')
  },
  down: (db) => {
    db.exec('DROP INDEX IF EXISTS idx_users_email')
    db.exec('DROP INDEX IF EXISTS idx_users_company')
    db.exec('DROP INDEX IF EXISTS idx_sessions_token')
    db.exec('DROP INDEX IF EXISTS idx_projects_company')
    db.exec('DROP INDEX IF EXISTS idx_projects_status')
    db.exec('DROP INDEX IF EXISTS idx_subcontractors_company')
    db.exec('DROP INDEX IF EXISTS idx_subcontractors_abn')
  }
}
```

**Step 4: Update db/index.ts to use migration system**

Replace inline schema creation with:

```typescript
import { runMigrations } from './migrations'
import { migration as m001 } from './migrations/001_initial_schema'
import { migration as m002 } from './migrations/002_add_indexes'

const migrations = [m001, m002]

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'riskshield.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')

    // Run migrations
    const applied = runMigrations(db, migrations)
    if (applied > 0) {
      console.log(`Applied ${applied} migrations`)
    }
  }
  return db
}
```

**Step 5: Add migration scripts to package.json**

```json
{
  "scripts": {
    "db:migrate": "tsx lib/db/migrations/run.ts",
    "db:rollback": "tsx lib/db/migrations/run.ts --rollback"
  }
}
```

**Step 6: Commit**

```bash
git add lib/db/migrations/ package.json
git commit -m "refactor: implement proper database migration system"
```

---

## Phase 6: Documentation

### Task 12: Create Environment Documentation

**Files:**
- Create: `.env.example` (if not already created)
- Create: `docs/ENVIRONMENT.md`
- Create: `docs/DEPLOYMENT.md`

**Step 1: Create environment documentation**

```markdown
<!-- docs/ENVIRONMENT.md -->
# Environment Variables

## Required Variables

### JWT_SECRET
**Required in production**

Secret key for signing JWT tokens. Must be at least 32 characters.

Generate with:
```bash
openssl rand -base64 32
```

### Database (Supabase)

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)

### Real-time (Convex)

- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL

### AI Processing

- `OPENAI_API_KEY` - OpenAI API key for GPT-4V document analysis

## Optional Variables

### Email (SendGrid)

- `SENDGRID_API_KEY` - SendGrid API key for email notifications

### SMS (Twilio)

- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Twilio phone number for sending SMS

## Development vs Production

| Variable | Development | Production |
|----------|-------------|------------|
| JWT_SECRET | Optional (uses fallback) | **Required** |
| NODE_ENV | development | production |
| Database | SQLite (local) | Supabase (cloud) |
```

**Step 2: Create deployment documentation**

```markdown
<!-- docs/DEPLOYMENT.md -->
# Deployment Guide

## Prerequisites

1. Node.js 18+
2. Supabase account
3. Convex account
4. OpenAI API key
5. (Optional) SendGrid account
6. (Optional) Twilio account

## Vercel Deployment

### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Select the `main` branch

### 2. Configure Environment Variables

Add the following environment variables in Vercel dashboard:

- `JWT_SECRET` - Generate secure random string
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `OPENAI_API_KEY`

### 3. Database Setup

The production app uses Supabase PostgreSQL instead of local SQLite.

1. Create a Supabase project
2. Run the schema migrations
3. Update environment variables

### 4. Deploy

```bash
vercel --prod
```

## Security Checklist

- [ ] JWT_SECRET is set and secure (32+ chars)
- [ ] All API keys are set in environment variables
- [ ] HTTPS is enabled
- [ ] Rate limiting is configured
- [ ] Error tracking is set up (e.g., Sentry)
```

**Step 3: Commit**

```bash
git add docs/ENVIRONMENT.md docs/DEPLOYMENT.md .env.example
git commit -m "docs: add environment and deployment documentation"
```

---

## Summary

This plan addresses all critical and important issues identified in the code review:

### Critical Issues Fixed
1. **JWT Secret Fallback** - Task 1
2. **No Middleware** - Task 2
3. **No Tests** - Tasks 4, 5, 6, 7

### Important Issues Fixed
4. **No Rate Limiting** - Task 3
5. **No Error Boundaries** - Task 8
6. **No Caching** - Task 9
7. **No Pagination** - Task 10
8. **Inline Migrations** - Task 11

### Documentation Added
9. **Environment Docs** - Task 12

---

## Estimated Effort

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1: Security | 1-3 | 2-3 hours |
| Phase 2: Testing | 4-7 | 4-6 hours |
| Phase 3: Error Handling | 8 | 1-2 hours |
| Phase 4: Performance | 9-10 | 2-3 hours |
| Phase 5: Database | 11 | 2-3 hours |
| Phase 6: Documentation | 12 | 1 hour |

**Total: 12-18 hours**

---

## Post-Implementation Verification

After completing all tasks:

1. Run full test suite: `npm test`
2. Run E2E tests: `npm run test:e2e`
3. Check test coverage: `npm run test:coverage`
4. Manual smoke test of auth flow
5. Verify rate limiting works
6. Verify error boundaries catch errors
7. Check pagination works on lists
8. Verify migrations run cleanly on fresh DB
