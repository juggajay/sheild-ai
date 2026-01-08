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

// Security: Only trust proxy headers when behind a known reverse proxy
// Set TRUST_PROXY=true in environment when behind a trusted proxy (e.g., Vercel, CloudFlare)
const TRUST_PROXY = process.env.TRUST_PROXY === 'true'

// Allow disabling rate limiting for stress testing
// SECURITY: Only set this in development/testing environments, NEVER in production
const DISABLE_RATE_LIMIT = process.env.DISABLE_RATE_LIMIT === 'true' && process.env.NODE_ENV !== 'production'

export function rateLimit(options: RateLimitOptions) {
  const { interval, limit } = options

  return {
    check: (request: NextRequest, name: string): RateLimitResult => {
      // Bypass rate limiting for stress tests (only in non-production)
      if (DISABLE_RATE_LIMIT) {
        return {
          success: true,
          limit: Infinity,
          remaining: Infinity,
          reset: 0
        }
      }

      const limiter = getRateLimiter(name, options)
      // Security: Only use proxy headers when explicitly configured to trust them
      // This prevents IP spoofing attacks via X-Forwarded-For manipulation
      let ip: string
      if (TRUST_PROXY) {
        // Trust only the first IP from X-Forwarded-For (set by trusted proxy)
        ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'anonymous'
      } else {
        // In non-proxy environments, fall back to anonymous (all requests share limit)
        // This is safe because without proxy headers, we can't reliably identify clients
        ip = 'anonymous'
      }

      const now = Date.now()
      const windowStart = now - interval
      const timestamps = limiter.get(ip) || []
      const validTimestamps = timestamps.filter(ts => ts > windowStart)

      if (validTimestamps.length >= limit) {
        return {
          success: false,
          limit,
          remaining: 0,
          reset: Math.ceil((validTimestamps[0] + interval - now) / 1000)
        }
      }

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

// Configurable rate limits via environment variables
const AUTH_RATE_LIMIT_WINDOW = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || '900000', 10) // Default: 15 minutes
const AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10) // Default: 5 attempts
const API_RATE_LIMIT_WINDOW = parseInt(process.env.API_RATE_LIMIT_WINDOW || '60000', 10) // Default: 1 minute
const API_RATE_LIMIT_MAX = parseInt(process.env.API_RATE_LIMIT_MAX || '60', 10) // Default: 60 requests

// Pre-configured limiters
export const authLimiter = rateLimit({
  interval: AUTH_RATE_LIMIT_WINDOW,
  uniqueTokenPerInterval: 500,
  limit: AUTH_RATE_LIMIT_MAX,
})

export const apiLimiter = rateLimit({
  interval: API_RATE_LIMIT_WINDOW,
  uniqueTokenPerInterval: 1000,
  limit: API_RATE_LIMIT_MAX,
})

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests', retryAfter: result.reset },
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
