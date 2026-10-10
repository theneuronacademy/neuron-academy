// Phase 19 — scheduled delivery worker helpers (pure, DB-free, server-side).
// Used by GET /api/cron/notifications and by scripts/notification-check.ts.
// - No database access here (route owns all Prisma calls).
// - No network calls here (route owns provider calls).
// - No secrets, phones, emails, tokens, or message bodies here — aggregates only.
// - Every helper is total (never throws on malformed input).

import { createHash, timingSafeEqual } from "node:crypto";

/** Default cron batch size (?limit=25). */
export const CRON_DEFAULT_LIMIT = 25;
/** Safe maximum cron batch size (bounded fan-out per tick). */
export const CRON_MAX_LIMIT = 100;
/** Minimum cron batch size. */
export const CRON_MIN_LIMIT = 1;
/** Maximum attempts per delivery row before it goes terminal (non-retryable). */
export const MAX_WORKER_ATTEMPTS = 5;
/** Retry backoff for transient worker failures (matches engine retryAt). */
export const WORKER_RETRY_DELAY_MS = 15 * 60 * 1000;
/** Reminder scan horizon: tests starting within 24h get one TEST_REMINDER. */
export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Reminder dispatches per tick (bounded; each fans out via the engine). */
export const MAX_REMINDERS_PER_TICK = 5;

export type CronLimitResult = { ok: true; limit: number } | { ok: false; error: string; code: string };

/**
 * Parse ?limit= for the cron worker. Missing → default 25.
 * Present must be an integer 1–100, else CRON_BAD_LIMIT (400).
 */
export function parseCronLimit(raw: unknown): CronLimitResult {
  if (raw === null || raw === undefined) return { ok: true, limit: CRON_DEFAULT_LIMIT };
  const s = String(raw).trim();
  if (s === "") return { ok: false, error: "Invalid limit. Use an integer 1–100.", code: "CRON_BAD_LIMIT" };
  if (!/^\d+$/.test(s)) return { ok: false, error: "Invalid limit. Use an integer 1–100.", code: "CRON_BAD_LIMIT" };
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < CRON_MIN_LIMIT || n > CRON_MAX_LIMIT) {
    return { ok: false, error: "Invalid limit. Use an integer 1–100.", code: "CRON_BAD_LIMIT" };
  }
  return { ok: true, limit: n };
}

/** True when a Notification header is due for the worker (SCHEDULED + past). */
export function isDueScheduledNotification(
  n: { status?: unknown; scheduledAt?: Date | string | null | undefined },
  now: Date = new Date()
): boolean {
  try {
    if (n?.status !== "SCHEDULED") return false;
    const at = n.scheduledAt;
    if (at === null || at === undefined) return false;
    const t = at instanceof Date ? at.getTime() : new Date(String(at)).getTime();
    if (!Number.isFinite(t)) return false;
    return t <= now.getTime();
  } catch {
    return false;
  }
}

export interface RetryCandidate {
  status?: unknown;
  retryable?: unknown;
  nextAttemptAt?: Date | string | null | undefined;
  attemptCount?: unknown;
}

/**
 * True when a NotificationDelivery row is eligible for a worker retry.
 * Only FAILED/RETRYING + retryable + under attempt cap + backoff due.
 * CREATED rows are handled via the due-header path, never here.
 * QUEUED/PROCESSING are in-flight and never claimed (concurrency safety).
 * Terminal rows (SENT/DELIVERED/SKIPPED) are never eligible.
 */
export function isRetryEligibleDelivery(
  d: RetryCandidate,
  now: Date = new Date(),
  maxAttempts: number = MAX_WORKER_ATTEMPTS
): boolean {
  try {
    if (d?.status !== "FAILED" && d?.status !== "RETRYING") return false;
    if (d?.retryable !== true) return false;
    const attempts = typeof d.attemptCount === "number" && Number.isFinite(d.attemptCount) ? d.attemptCount : 0;
    if (attempts >= maxAttempts) return false;
    const next = d.nextAttemptAt;
    if (next === null || next === undefined) return true;
    const t = next instanceof Date ? next.getTime() : new Date(String(next)).getTime();
    if (!Number.isFinite(t)) return false;
    return t <= now.getTime();
  } catch {
    return false;
  }
}

/**
 * True when a delivery status is terminal and must never be reprocessed.
 * SENT/DELIVERED/SKIPPED are always terminal. FAILED is terminal unless it is
 * retryable and under the attempt cap. RETRYING is terminal once capped.
 * Unknown statuses are terminal (fail-closed: never touch what we don't know).
 */
export function isTerminalDeliveryStatus(
  status: unknown,
  opts?: { retryable?: unknown; attemptCount?: unknown; maxAttempts?: number }
): boolean {
  if (status === "SENT" || status === "DELIVERED" || status === "SKIPPED") return true;
  const max = typeof opts?.maxAttempts === "number" && Number.isFinite(opts.maxAttempts) ? opts.maxAttempts : MAX_WORKER_ATTEMPTS;
  const attempts =
    typeof opts?.attemptCount === "number" && Number.isFinite(opts.attemptCount) ? (opts.attemptCount as number) : 0;
  if (status === "FAILED") {
    if (opts?.retryable !== true) return true;
    return attempts >= max;
  }
  if (status === "RETRYING") return attempts >= max;
  if (status === "CREATED" || status === "QUEUED" || status === "PROCESSING") return false;
  return true;
}

/**
 * Extract the presented cron secret without logging it.
 * Prefers `Authorization: Bearer <secret>`, falls back to `x-cron-secret`.
 * Returns null when absent or malformed. Bounded length (1–512).
 */
export function extractBearerSecret(authHeader: unknown, xCronSecret: unknown): string | null {
  try {
    if (typeof authHeader === "string" && authHeader.length > 0) {
      const m = authHeader.match(/^Bearer\s+(.+)$/);
      if (m) {
        const token = m[1].trim().slice(0, 512);
        if (token.length >= 1 && token.length <= 512) return token;
        return null;
      }
    }
    if (typeof xCronSecret === "string") {
      const token = xCronSecret.trim().slice(0, 512);
      if (token.length >= 1 && token.length <= 512) return token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Constant-time secret comparison. False when either side is missing/empty.
 * Hashes both sides (sha256) so timingSafeEqual never throws on length
 * mismatch. Never logs either input — callers must not log secrets.
 */
export function cronSecretsEqual(provided: string, expected: string): boolean {
  try {
    if (typeof provided !== "string" || typeof expected !== "string") return false;
    if (provided.length === 0 || expected.length === 0) return false;
    if (provided.length > 512 || expected.length > 512) return false;
    const a = createHash("sha256").update(provided, "utf8").digest();
    const b = createHash("sha256").update(expected, "utf8").digest();
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface CronAggregate {
  limit: number;
  claimedHeaders: number;
  processed: number;
  deliveredInApp: number;
  sentSms: number;
  failed: number;
  skipped: number;
  retried: number;
  reminders: number;
  concurrentSkipped: number;
}

/** Build an aggregate-only summary (counts, never recipient data). */
export function buildCronSummary(c: CronAggregate): CronAggregate {
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    limit: num(c.limit),
    claimedHeaders: num(c.claimedHeaders),
    processed: num(c.processed),
    deliveredInApp: num(c.deliveredInApp),
    sentSms: num(c.sentSms),
    failed: num(c.failed),
    skipped: num(c.skipped),
    retried: num(c.retried),
    reminders: num(c.reminders),
    concurrentSkipped: num(c.concurrentSkipped),
  };
}
