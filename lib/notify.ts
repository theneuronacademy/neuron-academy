// Phase 13 — centralized in-app notification helper (server-side, Prisma).
// Routes call safeNotify — it NEVER throws, so notification creation can
// never break the main transaction (publish, grant, submit, revoke).

import type { PrismaClient } from "@prisma/client";

type Db = PrismaClient;

export interface NotifyInput {
  title: string;
  message: string;
  type?: string;
  audience?: "ALL_STUDENTS" | "BATCH" | "FACULTY" | "INDIVIDUAL";
  channel?: "IN_APP" | "WEB_PUSH" | "MOBILE_PUSH";
  targetStudentId?: string;
  targetBatchId?: string;
  targetFacultyId?: string;
  targetUserId?: string;
  testId?: string;
  createdById?: string;
  // Phase 18c-step3 — persisted priority + idempotency + requested channels.
  // priority is allowlisted by the engine (LOW/NORMAL/HIGH/CRITICAL only).
  // idempotencyKey is the sharded persistent key ("<dispatch>#<shard>").
  priority?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  idempotencyKey?: string;
  requestedChannels?: ("SMS" | "PUSH" | "IN_APP")[];
}

/** Create a SENT in-app notification. Returns the id or null. Never throws. */
export async function safeNotify(
  db: Db,
  input: NotifyInput,
  opts?: { scheduledAt?: Date }
): Promise<string | null> {
  try {
    const scheduled = opts?.scheduledAt instanceof Date && !Number.isNaN(opts.scheduledAt.getTime());
    const data: Record<string, unknown> = {
      title: input.title.slice(0, 120),
      message: input.message.slice(0, 1000),
      type: (input.type ?? "general").slice(0, 40),
      audience: input.audience ?? "INDIVIDUAL",
      channel: input.channel ?? "IN_APP",
      targetStudentId: input.targetStudentId,
      targetBatchId: input.targetBatchId,
      targetFacultyId: input.targetFacultyId,
      targetUserId: input.targetUserId,
      testId: input.testId,
      createdById: input.createdById,
      // Phase 18b — future schedules persist as SCHEDULED (execution needs
      // the project's scheduler/cron; delivery is never faked).
      scheduledAt: scheduled ? opts.scheduledAt : undefined,
      sentAt: scheduled ? undefined : new Date(),
      status: scheduled ? "SCHEDULED" : "SENT",
    };
    // Phase 18c-step3 — additive persistence. Guarded so older fake Db
    // doubles (tests) and pre-migration clients keep working: unknown
    // fields are dropped silently by Prisma only when the column exists;
    // when the column is missing Prisma throws and we retry without it.
    const extra: Record<string, unknown> = {};
    if (input.priority === "LOW" || input.priority === "NORMAL" || input.priority === "HIGH" || input.priority === "CRITICAL") {
      extra.priority = input.priority;
    }
    if (typeof input.idempotencyKey === "string" && input.idempotencyKey.length > 0) {
      extra.idempotencyKey = input.idempotencyKey.slice(0, 200);
    }
    if (Array.isArray(input.requestedChannels) && input.requestedChannels.length > 0) {
      const clean = input.requestedChannels.filter((c) => c === "SMS" || c === "PUSH" || c === "IN_APP");
      if (clean.length > 0) extra.requestedChannels = clean;
    }
    try {
      const row = await (db.notification.create as (args: unknown) => Promise<{ id: string }>)({
        data: { ...data, ...extra },
        select: { id: true },
      });
      return row.id;
    } catch (err) {
      // Pre-migration database (no new columns): retry with base fields only.
      // P2002 (unique idempotencyKey) is NOT retried — it means a concurrent
      // duplicate won the race; return null so the engine treats it as DUPLICATE.
      const msg = err instanceof Error ? err.message : String(err ?? "");
      if (msg.includes("P2002") || msg.includes("Unique constraint") || msg.includes("idempotencyKey")) {
        return null;
      }
      if (Object.keys(extra).length > 0) {
        try {
          const row = await (db.notification.create as (args: unknown) => Promise<{ id: string }>)({
            data,
            select: { id: true },
          });
          return row.id;
        } catch {
          return null;
        }
      }
      return null;
    }
  } catch {
    return null;
  }
}

/** Message builders — keep wording consistent across routes. Types are the
 * Phase 18c canonical event names (see canonicalNotificationType); the engine
 * stores the same value it searches, so duplicates can never hide behind an
 * alias. */
export const notifyMessages = {
  freeTestPublished: (title: string) => ({
    title: "New scholarship test available",
    message: `${title} is now available. Open Scholarship Tests to start.`,
    type: "TEST_PUBLISHED",
  }),
  accessGranted: (title: string) => ({
    title: "Test access granted",
    message: `You have been granted access to ${title}. You can start the test now.`,
    type: "ACCESS_GRANTED",
  }),
  accessRevoked: (title: string) => ({
    title: "Test access revoked",
    message: `Your access to ${title} has been revoked. Contact the academy office for help.`,
    type: "ACCESS_REVOKED",
  }),
  resultReleased: (title: string, marks: number, total: number, pct: number) => ({
    title: "Your test result is available",
    message: `${title}: ${marks}/${total} (${pct}%). Open the result to review.`,
    type: "RESULT_RELEASED",
  }),
  // Phase 15 — absence alert only (PRESENT/LATE/LEAVE stay silent to avoid
  // daily notification spam). One alert per student per day max (see
  // attendance route dedup check before calling dispatchNotification).
  attendanceAbsent: (dateStr: string, batchName?: string) => ({
    title: "Absent marked",
    message: `You were marked absent on ${dateStr}${batchName ? ` (${batchName})` : ""}. Contact the academy office if this is incorrect.`,
    type: "ATTENDANCE_ABSENT",
  }),
};
