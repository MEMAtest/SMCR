import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";
import { rateLimit, getRateLimitIdentifier } from "./rate-limit";

/**
 * Get the current session for API routes
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Require authentication for an API route
 * Returns the session if authenticated, or returns an unauthorized response
 * Optionally applies rate limiting
 */
export async function requireAuth(request?: Request, applyRateLimit = true) {
  // Apply rate limiting if request is provided
  if (applyRateLimit && request) {
    const identifier = getRateLimitIdentifier(request);
    const limitResult = rateLimit(identifier, { maxRequests: 100, windowSeconds: 60 });

    if (limitResult.limited) {
      return {
        authorized: false,
        response: limitResult.response!,
      };
    }
  }

  const session = await getSession();

  if (!session || !session.user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    session,
    userId: session.user.id,
  };
}

/**
 * Require admin role for an API route
 * Returns the session if user is admin, or returns a forbidden response
 * Applies strict rate limiting for admin endpoints
 */
export async function requireAdmin(request?: Request) {
  // Apply stricter rate limiting for admin endpoints
  if (request) {
    const identifier = getRateLimitIdentifier(request);
    const limitResult = rateLimit(identifier, { maxRequests: 20, windowSeconds: 60 });

    if (limitResult.limited) {
      return {
        authorized: false,
        response: limitResult.response!,
      };
    }
  }

  const session = await getSession();

  if (!session || !session.user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      ),
    };
  }

  // @ts-ignore - role is a custom field
  const userRole = session.user.role || "user";

  if (userRole !== "admin") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    session,
    userId: session.user.id,
  };
}
