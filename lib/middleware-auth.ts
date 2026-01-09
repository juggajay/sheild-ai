import { NextRequest } from 'next/server'
import * as jose from 'jose'

/**
 * Public paths that don't require authentication
 * These are pages that unauthenticated users can access
 */
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/portal/login',
  '/portal/verify',
  '/preview-landing',
]

/**
 * Public API paths that don't require authentication
 * These are API endpoints that can be called without a valid session
 */
const API_PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/validate-reset-token',
  '/api/portal/auth/magic-link',
  '/api/portal/auth/verify',
  '/api/broker/auth/magic-link',
  '/api/broker/auth/verify',
  '/api/webhooks/sendgrid',
  '/api/debug/env', // Temporary - remove after debugging
]

/**
 * Check if a path is public (doesn't require authentication)
 */
export function isPublicPath(pathname: string): boolean {
  // Exact match for public paths
  if (PUBLIC_PATHS.includes(pathname)) return true

  // Exact match for public API paths
  if (API_PUBLIC_PATHS.includes(pathname)) return true

  // Next.js internal routes
  if (pathname.startsWith('/_next')) return true

  // Favicon and other static assets
  if (pathname.startsWith('/favicon')) return true

  // Static files (anything with a file extension)
  if (pathname.includes('.')) return true

  return false
}

/**
 * Check if the path is an API route
 */
export function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

/**
 * Check if the path is a portal route
 */
export function isPortalRoute(pathname: string): boolean {
  return pathname.startsWith('/portal/')
}

/**
 * Check if the path is a dashboard route
 */
export function isDashboardRoute(pathname: string): boolean {
  return pathname.startsWith('/dashboard')
}

/**
 * Check if the path is a broker route
 */
export function isBrokerRoute(pathname: string): boolean {
  return pathname.startsWith('/broker')
}

/**
 * Verify JWT token from request cookies
 * Uses jose library which is Edge Runtime compatible
 */
export async function verifyTokenFromRequest(request: NextRequest): Promise<{ valid: boolean; userId?: string; sessionId?: string; error?: string }> {
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    return { valid: false, error: 'No token provided' }
  }

  try {
    // Security: Require JWT_SECRET in production - never use fallback
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret && process.env.NODE_ENV === 'production') {
      console.error('[AUTH] CRITICAL: JWT_SECRET environment variable is not set in production!')
      return { valid: false, error: 'Server configuration error' }
    }

    const secret = new TextEncoder().encode(
      jwtSecret || 'riskshield-development-secret-key-DO-NOT-USE-IN-PRODUCTION'
    )

    const { payload } = await jose.jwtVerify(token, secret)

    return {
      valid: true,
      userId: payload.userId as string,
      sessionId: payload.sessionId as string
    }
  } catch (error) {
    // Handle specific JWT errors
    if (error instanceof jose.errors.JWTExpired) {
      return { valid: false, error: 'Token expired' }
    }
    if (error instanceof jose.errors.JWTInvalid) {
      return { valid: false, error: 'Invalid token format' }
    }
    if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
      return { valid: false, error: 'Token signature verification failed' }
    }

    return { valid: false, error: 'Invalid or expired token' }
  }
}
