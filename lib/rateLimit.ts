// Phase 20 — Rate Limiting for Student Auth Endpoints
// In-memory store with cleanup (suitable for single-instance or sticky sessions)
// For production multi-instance, use Redis/Upstash

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/** Cleanup expired entries periodically */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000); // Every minute

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // Prefix for the rate limit key
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

/**
 * Check and increment rate limit for a key
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const fullKey = `${config.keyPrefix}:${key}`;
  const entry = store.get(fullKey);

  if (!entry || entry.resetAt < Date.now()) {
    // New window
    const resetAt = Date.now() + config.windowMs;
    store.set(fullKey, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - Date.now(),
    };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/** Pre-configured rate limiters for student auth */
export const studentAuthRateLimits = {
  /** Login attempts: 5 per 15 minutes per IP */
  login: (ip: string) => checkRateLimit(ip, { windowMs: 15 * 60 * 1000, maxRequests: 5, keyPrefix: "auth:login" }),

  /** Registration attempts: 3 per hour per IP */
  register: (ip: string) => checkRateLimit(ip, { windowMs: 60 * 60 * 1000, maxRequests: 3, keyPrefix: "auth:register" }),

  /** Forgot password: 2 per hour per IP */
  forgotPassword: (ip: string) => checkRateLimit(ip, { windowMs: 60 * 60 * 1000, maxRequests: 2, keyPrefix: "auth:forgot" }),

  /** OTP request: 5 per hour per phone (handled in OTP route) */
  otpRequest: (phone: string) => checkRateLimit(phone, { windowMs: 60 * 60 * 1000, maxRequests: 5, keyPrefix: "otp:request" }),

  /** OTP verify: 5 per code (handled in OTP route) */
};

/** Get client IP from request */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Rate limit response helper */
export function rateLimitResponse(result: RateLimitResult) {
  const headers = new Headers();
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  if (!result.allowed && result.retryAfterMs) {
    headers.set("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
  }
  return headers;
}