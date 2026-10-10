// Phase 19 — scheduled notification worker (SERVER-ONLY cron).
// GET /api/cron/notifications?limit=25 — every 5 minutes (see vercel.json).
//
// Scope (v1, safe subset of the engine):
// - Claims due SCHEDULED Notification headers atomically (status guard) and
//   completes their CREATED deliveries: IN_APP → DELIVERED (durable write now
//   visible), SMS/PUSH via the existing providers with honest outcomes.
// - Retries FAILED/RETRYING retryable deliveries due for retry, bounded by
//   MAX_WORKER_ATTEMPTS. Terminal rows (SENT/DELIVERED/SKIPPED, exhausted
//   FAILED) are never touched.
// - Scans PUBLISHED tests starting within 24h and dispatches one
//   TEST_REMINDER per test (idempotent on testId, max 5 per tick, on behalf
//   of the earliest active ADMIN so attribution stays a real user).
// - Concurrency-safe: every mutation is claimed with updateMany(status guard)
//   before any send. Lost races count as concurrentSkipped, never double-send.
// - Aggregate counts only in the response. No phones, emails, tokens,
//   message bodies, or secrets. Secrets are never logged.
// - SMS without persisted template vars fails honestly (SMS_MISSING_VARS,
//   never attempted) instead of sending a wrong message. Real delivery is NOT
//   claimed as verified — see step-2 report.

import { NextRequest } from "next/server";
import { fail, ok, serverError, dbNotConfigured } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import {
  MAX_REMINDERS_PER_TICK,
  MAX_WORKER_ATTEMPTS,
  REMINDER_WINDOW_MS,
  WORKER_RETRY_DELAY_MS,
  buildCronSummary,
  cronSecretsEqual,
  extractBearerSecret,
  parseCronLimit,
} from "@/lib/cron-notifications";
import { normalizeIndianMobile } from "@/lib/otp";
import { notifyMessages } from "@/lib/notify";
import {
  academyName,
  flowIdFor,
  isSmsTemplateKey,
  isTemplateAllowedForEvent,
  renderSmsTemplate,
} from "@/lib/sms-templates";
import { sendSms } from "@/services/msg91";
import { dispatchNotification } from "@/services/notificationEngine";
import { sendNotification as sendPush } from "@/services/webPush";

export const dynamic = "force-dynamic";

type DueHeader = {
  id: string;
  type: string;
  title: string;
  message: string;
};

type DueDelivery = {
  id: string;
  notificationId: string;
  channel: string;
  status: string;
  attemptCount: number;
  retryable: boolean;
  recipientKey: string;
  userId: string | null;
  studentId: string | null;
  facultyId: string | null;
};

function isDeliveryModelAvailable(db: unknown): boolean {
  const m = (db as { notificationDelivery?: { findMany?: unknown; updateMany?: unknown } })?.notificationDelivery;
  const n = (db as { notification?: { findMany?: unknown; updateMany?: unknown } })?.notification;
  return Boolean(m?.findMany && m?.updateMany && n?.findMany && n?.updateMany);
}

async function resolveRecipientNamePhone(
  db: NonNullable<ReturnType<typeof getDb>>,
  d: DueDelivery
): Promise<{ name: string; phone: string }> {
  try {
    if (d.userId) {
      const u = await db.user.findUnique({ where: { id: d.userId }, select: { name: true, phone: true } });
      if (u) return { name: u.name ?? "", phone: u.phone ?? "" };
    }
    if (d.studentId) {
      const s = await db.student.findUnique({ where: { id: d.studentId }, select: { name: true, phone: true } });
      if (s) return { name: s.name ?? "", phone: s.phone ?? "" };
    }
    if (d.facultyId) {
      const f = await db.faculty.findUnique({ where: { id: d.facultyId }, select: { name: true, phone: true } });
      if (f) return { name: f.name ?? "", phone: f.phone ?? "" };
    }
  } catch {
    /* resolution failure → caller treats as invalid recipient */
  }
  return { name: "", phone: "" };
}

export async function GET(req: NextRequest) {
  // 1. Authenticate before any work. Never log secrets.
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected) {
    return fail("Cron secret is not configured.", 503, "CRON_NOT_CONFIGURED");
  }
  const provided = extractBearerSecret(req.headers.get("authorization"), req.headers.get("x-cron-secret"));
  if (!provided || !cronSecretsEqual(provided, expected)) {
    return fail("Unauthorized cron request.", 401, "CRON_UNAUTHORIZED");
  }

  // 2. Bounded batch size (default 25, max 100).
  const params = new URL(req.url).searchParams;
  const parsed = parseCronLimit(params.get("limit"));
  if (!parsed.ok) {
    return fail("Invalid limit. Use an integer 1–100.", 400, "CRON_BAD_LIMIT");
  }
  const limit = parsed.limit;

  // 3. Database required (no demo fallback for a worker).
  const db = getDb();
  if (!db) return dbNotConfigured("Processing scheduled notifications");
  if (!isDeliveryModelAvailable(db)) {
    return fail(
      "The notification delivery schema is unavailable. Apply the pending Prisma migration and regenerate the client.",
      409,
      "DELIVERY_AUDIT_UNAVAILABLE"
    );
  }

  const now = new Date();
  let claimedHeaders = 0;
  let processed = 0;
  let deliveredInApp = 0;
  let sentSms = 0;
  let failed = 0;
  let skipped = 0;
  let retried = 0;
  let reminders = 0;
  let concurrentSkipped = 0;
  let budget = limit;

  try {
    // 4. Claim due SCHEDULED headers (atomic: only one worker wins each row).
    const due = await db.notification.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lte: now } },
      orderBy: { scheduledAt: "asc" },
      take: limit,
      select: { id: true, type: true, title: true, message: true },
    });

    for (const h of due as DueHeader[]) {
      if (budget <= 0) break;
      let claim: { count: number };
      try {
        claim = await db.notification.updateMany({
          where: { id: h.id, status: "SCHEDULED" },
          data: { status: "SENT", sentAt: now },
        });
      } catch {
        concurrentSkipped += 1;
        continue;
      }
      if (claim.count !== 1) {
        concurrentSkipped += 1;
        continue;
      }
      claimedHeaders += 1;

      // 5. Complete this header's CREATED deliveries (bounded by budget).
      let rows: DueDelivery[] = [];
      try {
        rows = (await db.notificationDelivery.findMany({
          where: { notificationId: h.id, status: "CREATED" },
          take: budget,
          select: {
            id: true,
            notificationId: true,
            channel: true,
            status: true,
            attemptCount: true,
            retryable: true,
            recipientKey: true,
            userId: true,
            studentId: true,
            facultyId: true,
          },
        })) as unknown as DueDelivery[];
      } catch {
        continue;
      }
      for (const d of rows) {
        if (budget <= 0) break;
        // Atomic per-row claim before any send (never fetch-then-send).
        let got: { count: number };
        try {
          got = await db.notificationDelivery.updateMany({
            where: { id: d.id, status: "CREATED" },
            data: { status: "PROCESSING", lastAttemptAt: now, attemptCount: { increment: 1 } },
          });
        } catch {
          concurrentSkipped += 1;
          continue;
        }
        if (got.count !== 1) {
          concurrentSkipped += 1;
          continue;
        }
        budget -= 1;
        processed += 1;
        try {
          if (d.channel === "IN_APP") {
            await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "DELIVERED", deliveredAt: now, lastAttemptAt: now } });
            deliveredInApp += 1;
          } else if (d.channel === "PUSH") {
            if (!d.userId) {
              await db.notificationDelivery.update({
                where: { id: d.id },
                data: { status: "SKIPPED", errorCode: "PUSH_NO_IDENTITY", errorMessage: "No user identity for push.", lastAttemptAt: now },
              });
              skipped += 1;
            } else {
              const res = await sendPush(db, d.userId, { title: h.title, message: h.message });
              if (res.ok) {
                // Real provider acceptance (stub never reaches here today).
                await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "SENT", sentAt: now, lastAttemptAt: now } });
              } else {
                await db.notificationDelivery.update({
                  where: { id: d.id },
                  data: {
                    status: "FAILED",
                    errorCode: res.code.slice(0, 60),
                    errorMessage: "Push delivery failed.",
                    retryable: false,
                    failedAt: now,
                    lastAttemptAt: now,
                  },
                });
                failed += 1;
              }
            }
          } else {
            // SMS lane — reuse engine template policy; never invent vars.
            const templateOk = isSmsTemplateKey(h.type);
            const pairingOk = templateOk && isTemplateAllowedForEvent(h.type as "ADMIN_ANNOUNCEMENT", h.type);
            const flowId = templateOk ? flowIdFor(h.type as "ADMIN_ANNOUNCEMENT") : "";
            if (!templateOk || !pairingOk || !flowId) {
              await db.notificationDelivery.update({
                where: { id: d.id },
                data: {
                  status: "SKIPPED",
                  errorCode: "SMS_TEMPLATE_NOT_CONFIGURED",
                  errorMessage: "SMS template is not configured.",
                  retryable: false,
                  lastAttemptAt: now,
                },
              });
              skipped += 1;
              continue;
            }
            const who = await resolveRecipientNamePhone(db, d);
            const vars: Record<string, unknown> = {
              academyName: academyName(),
              message: h.message,
              studentName: who.name,
              facultyName: who.name,
              batchName: "",
            };
            const { missing } = renderSmsTemplate(h.type as "ADMIN_ANNOUNCEMENT", vars);
            if (missing.length > 0) {
              await db.notificationDelivery.update({
                where: { id: d.id },
                data: {
                  status: "FAILED",
                  errorCode: "SMS_MISSING_VARS",
                  errorMessage: "Missing SMS variables.",
                  retryable: false,
                  failedAt: now,
                  lastAttemptAt: now,
                },
              });
              failed += 1;
              continue;
            }
            const normalized = normalizeIndianMobile(who.phone);
            if (!normalized) {
              await db.notificationDelivery.update({
                where: { id: d.id },
                data: {
                  status: "SKIPPED",
                  errorCode: "SMS_INVALID_RECIPIENT",
                  errorMessage: "Invalid recipient number.",
                  retryable: false,
                  lastAttemptAt: now,
                },
              });
              skipped += 1;
              continue;
            }
            const flowVars: Record<string, string> = {};
            for (const [k, v] of Object.entries(vars)) {
              if (v !== undefined && v !== null && String(v) !== "") flowVars[k] = String(v).slice(0, 500);
            }
            const res = await sendSms(normalized, flowId, flowVars);
            if (res.ok) {
              await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "SENT", sentAt: now, lastAttemptAt: now } });
              sentSms += 1;
            } else {
              await db.notificationDelivery.update({
                where: { id: d.id },
                data: {
                  status: "FAILED",
                  errorCode: (res.code || "SMS_PROVIDER_ERROR").slice(0, 60),
                  errorMessage: "Could not send the SMS.",
                  retryable: !!res.retryable,
                  nextAttemptAt: res.retryable ? new Date(now.getTime() + WORKER_RETRY_DELAY_MS) : undefined,
                  failedAt: now,
                  lastAttemptAt: now,
                },
              });
              failed += 1;
            }
          }
        } catch {
          failed += 1;
        }
      }
    }

    // 6. Retry due FAILED/RETRYING retryable rows (remaining budget only).
    if (budget > 0) {
      let retryRows: (DueDelivery & { notification: { title: string; message: string; type: string } | null })[] = [];
      try {
        retryRows = (await db.notificationDelivery.findMany({
          where: {
            status: { in: ["FAILED", "RETRYING"] },
            retryable: true,
            attemptCount: { lt: MAX_WORKER_ATTEMPTS },
            OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
          },
          orderBy: { nextAttemptAt: "asc" },
          take: budget,
          select: {
            id: true,
            notificationId: true,
            channel: true,
            status: true,
            attemptCount: true,
            retryable: true,
            recipientKey: true,
            userId: true,
            studentId: true,
            facultyId: true,
            notification: { select: { title: true, message: true, type: true } },
          },
        })) as unknown as (DueDelivery & { notification: { title: string; message: string; type: string } | null })[];
      } catch {
        retryRows = [];
      }
      for (const d of retryRows) {
        if (budget <= 0) break;
        if (d.attemptCount >= MAX_WORKER_ATTEMPTS) {
          skipped += 1;
          continue;
        }
        let got: { count: number };
        try {
          got = await db.notificationDelivery.updateMany({
            where: { id: d.id, status: { in: ["FAILED", "RETRYING"] }, retryable: true },
            data: { status: "PROCESSING", lastAttemptAt: now, attemptCount: { increment: 1 } },
          });
        } catch {
          concurrentSkipped += 1;
          continue;
        }
        if (got.count !== 1) {
          concurrentSkipped += 1;
          continue;
        }
        budget -= 1;
        processed += 1;
        retried += 1;
        const header = d.notification;
        try {
          if (d.channel === "IN_APP") {
            await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "DELIVERED", deliveredAt: now, lastAttemptAt: now } });
            deliveredInApp += 1;
          } else if (d.channel === "PUSH" || !header) {
            await db.notificationDelivery.update({
              where: { id: d.id },
              data: {
                status: "FAILED",
                errorCode: "PUSH_PROVIDER_ERROR",
                errorMessage: "Push delivery failed.",
                retryable: false,
                failedAt: now,
                lastAttemptAt: now,
              },
            });
            failed += 1;
          } else {
            const templateOk = isSmsTemplateKey(header.type);
            const pairingOk = templateOk && isTemplateAllowedForEvent(header.type as "ADMIN_ANNOUNCEMENT", header.type);
            const flowId = templateOk ? flowIdFor(header.type as "ADMIN_ANNOUNCEMENT") : "";
            if (!templateOk || !pairingOk || !flowId) {
              await db.notificationDelivery.update({
                where: { id: d.id },
                data: { status: "SKIPPED", errorCode: "SMS_TEMPLATE_NOT_CONFIGURED", errorMessage: "SMS template is not configured.", retryable: false, lastAttemptAt: now },
              });
              skipped += 1;
              continue;
            }
            const who = await resolveRecipientNamePhone(db, d);
            const vars: Record<string, unknown> = {
              academyName: academyName(),
              message: header.message,
              studentName: who.name,
              facultyName: who.name,
              batchName: "",
            };
            const { missing } = renderSmsTemplate(header.type as "ADMIN_ANNOUNCEMENT", vars);
            if (missing.length > 0) {
              await db.notificationDelivery.update({
                where: { id: d.id },
                data: { status: "FAILED", errorCode: "SMS_MISSING_VARS", errorMessage: "Missing SMS variables.", retryable: false, failedAt: now, lastAttemptAt: now },
              });
              failed += 1;
              continue;
            }
            const normalized = normalizeIndianMobile(who.phone);
            if (!normalized) {
              await db.notificationDelivery.update({
                where: { id: d.id },
                data: { status: "SKIPPED", errorCode: "SMS_INVALID_RECIPIENT", errorMessage: "Invalid recipient number.", retryable: false, lastAttemptAt: now },
              });
              skipped += 1;
              continue;
            }
            const flowVars: Record<string, string> = {};
            for (const [k, v] of Object.entries(vars)) {
              if (v !== undefined && v !== null && String(v) !== "") flowVars[k] = String(v).slice(0, 500);
            }
            const res = await sendSms(normalized, flowId, flowVars);
            const nextCount = d.attemptCount + 1;
            if (res.ok) {
              await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "SENT", sentAt: now, lastAttemptAt: now } });
              sentSms += 1;
            } else {
              const exhausted = nextCount >= MAX_WORKER_ATTEMPTS;
              await db.notificationDelivery.update({
                where: { id: d.id },
                data: {
                  status: "FAILED",
                  errorCode: (res.code || "SMS_PROVIDER_ERROR").slice(0, 60),
                  errorMessage: "Could not send the SMS.",
                  retryable: !exhausted && !!res.retryable,
                  nextAttemptAt: !exhausted && res.retryable ? new Date(now.getTime() + WORKER_RETRY_DELAY_MS) : undefined,
                  failedAt: now,
                  lastAttemptAt: now,
                },
              });
              failed += 1;
            }
          }
        } catch {
          failed += 1;
        }
      }
    }

    // 7. TEST_REMINDER scan: PUBLISHED tests starting within 24h get one
    // reminder each (idempotent on testId — a tick never re-reminds).
    // SCHEDULED/DRAFT tests are excluded (unpublished content must not leak).
    // Attribution needs a real user FK, so the earliest active ADMIN stands
    // in; with no active admin the scan is skipped honestly.
    {
      let adminId: string | null = null;
      let reminderDue: { id: string; title: string; batchId: string | null; startTime: Date }[] = [];
      try {
        const model = (db as { user?: { findFirst?: unknown }; test?: { findMany?: unknown } });
        if (typeof model.user?.findFirst === "function" && typeof model.test?.findMany === "function") {
          const admin = (await (model.user.findFirst as (args: unknown) => Promise<{ id: string } | null>)({
            where: { role: "ADMIN", isActive: true },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          }).catch(() => null)) as { id: string } | null;
          adminId = admin?.id ?? null;
          if (adminId) {
            reminderDue = (await (model.test.findMany as (args: unknown) => Promise<
              { id: string; title: string; batchId: string | null; startTime: Date }[]
            >)({
              where: {
                status: "PUBLISHED",
                isActive: true,
                startTime: { gt: now, lte: new Date(now.getTime() + REMINDER_WINDOW_MS) },
              },
              orderBy: { startTime: "asc" },
              take: MAX_REMINDERS_PER_TICK,
              select: { id: true, title: true, batchId: true, startTime: true },
            }).catch(() => [])) as { id: string; title: string; batchId: string | null; startTime: Date }[];
          }
        }
      } catch {
        adminId = null;
        reminderDue = [];
      }
      for (const t of reminderDue) {
        if (!(t.startTime instanceof Date) || Number.isNaN(t.startTime.getTime())) continue;
        const dateStr = t.startTime.toISOString().slice(0, 10);
        const timeStr = t.startTime.toISOString().slice(11, 16);
        const msg = notifyMessages.testReminder(t.title, dateStr);
        try {
          const report = await dispatchNotification(db, {
            event: "TEST_REMINDER",
            actor: { id: adminId as string, role: "ADMIN" },
            audience: t.batchId ? { kind: "BATCH", batchId: t.batchId } : { kind: "ALL_STUDENTS" },
            title: msg.title,
            message: msg.message,
            templateKey: "TEST_REMINDER",
            vars: { testName: t.title, testDate: dateStr, testTime: timeStr ? ` at ${timeStr}` : "" },
            testId: t.id,
            createdById: adminId as string,
            internal: true,
            idempotencyKey: `TEST_REMINDER:${t.id}`,
          });
          if (report.ok && !report.duplicate) reminders += 1;
        } catch {
          /* dispatch never throws; duplicate keys converge silently */
        }
      }
    }

    // Aggregate-only log (no secrets, phones, or bodies).
    console.warn(
      `[cron:notifications] headers=${claimedHeaders} processed=${processed} inapp=${deliveredInApp} sms=${sentSms} failed=${failed} skipped=${skipped} retried=${retried} reminders=${reminders} concurrent=${concurrentSkipped} limit=${limit}`
    );
    return ok({
      ...buildCronSummary({
        limit,
        claimedHeaders,
        processed,
        deliveredInApp,
        sentSms,
        failed,
        skipped,
        retried,
        reminders,
        concurrentSkipped,
      }),
      worker: "cron-notifications-v1",
      deliveryAudit: "ok",
    });
  } catch (err) {
    return serverError("cron:notifications", err);
  }
}
