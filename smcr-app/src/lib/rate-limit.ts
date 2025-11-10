import { NextResponse } from "next/server";

/**
 * Simple in-memory rate limiter
 * For production, consider using Redis or a service like Upstash
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetTime < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => rateLimitStore.delete(key));
}, 10 * 60 * 1000);

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/**
 * Rate limit an API request based on identifier (e.g., IP address or user ID)
 *
 * @param identifier - Unique identifier for rate limiting (IP, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Object with limited flag and optional response
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 100, windowSeconds: 60 }
): { limited: boolean; response?: NextResponse; remaining: number } {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    // First request or window expired - create new entry
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });

    return {
      limited: false,
      remaining: config.maxRequests - 1,
    };
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    return {
      limited: true,
      remaining: 0,
      response: NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": config.maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(entry.resetTime).toISOString(),
          },
        }
      ),
    };
  }

  // Increment counter
  entry.count++;

  return {
    limited: false,
    remaining: config.maxRequests - entry.count,
  };
}

/**
 * Get rate limit identifier from request
 * Uses IP address or forwarded IP
 */
export function getRateLimitIdentifier(request: Request): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  // Fallback to a default (not ideal, but prevents crashes)
  return "unknown";
}
