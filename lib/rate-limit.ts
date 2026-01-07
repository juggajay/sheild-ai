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
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                 request.headers.get('x-real-ip') ||
                 'anonymous'

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
