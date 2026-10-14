// Phase 3 — Notifications API. No push provider yet (later phase).
// Demo fallback when DATABASE_URL is missing.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).
// Phase 18b — ADMIN sends go through the centralized notification engine:
// validate → authorize → resolve audience server-side → channel router
// (SMS via MSG91 Flow when configured + push + in-app) → delivery report.
// Scheduling persists SCHEDULED state (execution needs scheduler/cron).
// Mass SMS always needs confirmMassSend (never one accidental click).
// Phase 18c-step3 — ADMIN history is delivery-audited: every count comes
// from persisted Notification + NotificationDelivery rows (never invented).
// Filters (all server-side, bounded): channel, status, priority, event,
// recipient, date, failedOnly. Detail lives at GET /api/notifications/[id]
// (ADMIN-only, paginated deliveries).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { missingFields, parseDate } from "@/lib/validation";
import { isKnownEvent } from "@/lib/notification-events";
import { eventForTemplate, isSmsTemplateKey } from "@/lib/sms-templates";
import { dispatchNotification, estimateAudience, type AudienceKind } from "@/services/notificationEngine";
import { DEMO_NOTIFICATIONS } from "@/data/admin";

export const dynamic = "force-dynamic";

const AUDIENCES = ["ALL_STUDENTS", "BATCH", "FACULTY", "INDIVIDUAL"] as const;

const ENGINE_AUDIENCES: readonly AudienceKind[] = [
  "INDIVIDUAL",
  "BATCH",
  "ALL_STUDENTS",
  "REGULAR",
  "SCHOLARSHIP",
  "FACULTY",
  "ALL_FACULTY",
  "ALL_USERS",
];

const DELIVERY_CHANNELS = ["SMS", "PUSH", "IN_APP"] as const;
const DELIVERY_STATUSES = ["CREATED", "QUEUED", "PROCESSING", "SENT", "DELIVERED", "FAILED", "RETRYING", "SKIPPED"] as const;
const HEADER_STATUSES = ["DRAFT", "SCHEDULED", "SENT"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;

function audienceLabel(a: string): string {
  if (a === "ALL_STUDENTS") return "All students";
  if (a === "BATCH") return "Batch";
  if (a === "FACULTY") return "Faculty";
  return "Individual";
}

type HistoryRow = {
  id: string;
  title: string;
  message: string;
  audience: string;
  date: string;
  status: string;
  event: string;
  rawAudience: string;
  priority: string;
  channels: string[];
  overallStatus: string;
  recipientCount: number;
  smsSent: number;
  smsFailed: number;
  pushSent: number;
  pushFailed: number;
  inAppCount: number;
  createdAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
};

type DeliveryAuditState = "ok" | "unavailable";
type DeliveryAuditReason = null | "migration-missing" | "query-failed";

function isDeliveryModelAvailable(db: unknown): boolean {
  const model = (db as { notificationDelivery?: { groupBy?: unknown; findMany?: unknown } })?.notificationDelivery;
  return Boolean(model?.groupBy && model?.findMany);
}

async function deliveryCountsFor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  ids: string[]
): Promise<{
  counts: Map<string, { recipientCount: number; smsSent: number; smsFailed: number; pushSent: number; pushFailed: number; inAppCount: number }>;
  audit: DeliveryAuditState;
  reason: DeliveryAuditReason;
}> {
  const out = new Map<string, { recipientCount: number; smsSent: number; smsFailed: number; pushSent: number; pushFailed: number; inAppCount: number }>();
  for (const id of ids) {
    out.set(id, { recipientCount: 0, smsSent: 0, smsFailed: 0, pushSent: 0, pushFailed: 0, inAppCount: 0 });
  }
  if (ids.length === 0) return { counts: out, audit: "ok", reason: null };
  // Phase 18c-step5 (P0): the generated client predates the delivery
  // migration when the model is absent. That is schema unavailability —
  // report it honestly instead of authoritative-looking zeroes.
  const model = db.notificationDelivery;
  if (!model?.groupBy || !model?.findMany) {
    return { counts: out, audit: "unavailable", reason: "migration-missing" };
  }
  // Phase 18c-step5 (P0): a query failure here is NOT a confirmed missing
  // migration (the model exists on the client). Flag query-failed so callers
  // never mistake partial zeroes for audited counts.
  try {
    let groups: { notificationId: string; channel: string; status: string; _count: { _all: number } }[] = [];
    groups = await model.groupBy({
      by: ["notificationId", "channel", "status"],
      where: { notificationId: { in: ids } },
      _count: { _all: true },
    });
    const recipients = new Map<string, Set<string>>();
    // Recipient cardinality needs distinct recipientKey per notification.
    // If this second query fails the channel counts above are still valid,
    // but the aggregate is partial — flag the whole audit unavailable.
    try {
      const rrows = await model.findMany({
        where: { notificationId: { in: ids } },
        select: { notificationId: true, recipientKey: true },
        take: 5000,
      });
      for (const r of rrows as { notificationId: string; recipientKey: string }[]) {
        if (!recipients.has(r.notificationId)) recipients.set(r.notificationId, new Set());
        recipients.get(r.notificationId)?.add(r.recipientKey);
      }
    } catch {
      return { counts: out, audit: "unavailable", reason: "query-failed" };
    }
    for (const g of groups) {
      const slot = out.get(g.notificationId);
      if (!slot) continue;
      const n = g._count?._all ?? 0;
      if (g.channel === "SMS" && g.status === "SENT") slot.smsSent += n;
      if (g.channel === "SMS" && g.status === "FAILED") slot.smsFailed += n;
      if (g.channel === "PUSH" && g.status === "SENT") slot.pushSent += n;
      if (g.channel === "PUSH" && g.status === "FAILED") slot.pushFailed += n;
      // Phase 18c-step5 (P2): the engine only ever writes DELIVERED for
      // IN_APP rows; SENT is counted too so a future provider receipt that
      // lands as SENT is not silently dropped from the audit.
      if (g.channel === "IN_APP" && (g.status === "DELIVERED" || g.status === "SENT")) slot.inAppCount += n;
    }
    for (const [nid, set] of recipients) {
      const slot = out.get(nid);
      if (slot) slot.recipientCount = set.size;
    }
    return { counts: out, audit: "ok", reason: null };
  } catch {
    return { counts: out, audit: "unavailable", reason: "query-failed" };
  }
}

export async function GET(req: NextRequest) {
  // Broadcast history — ADMIN only (scoped per-user feeds land in Phase 5).
  // Delivery records are ADMIN-only: students/faculty cannot access this
  // route (401 anonymous, 403 non-admin via requireApiRole).
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return ok({ items: DEMO_NOTIFICATIONS, source: "demo" });
  // Phase 18b — audience estimate for the admin center (no dispatch).
  const params = new URL(req.url).searchParams;
  if (params.get("estimate") === "1") {
    const kind = String(params.get("audience") ?? "ALL_STUDENTS");
    if (!(ENGINE_AUDIENCES as readonly string[]).includes(kind)) {
      return fail("Unknown audience.", 400, "NOTIFY_BAD_AUDIENCE");
    }
    try {
      const est = await estimateAudience(db, {
        kind: kind as AudienceKind,
        batchId: params.get("batchId") ?? undefined,
      });
      return ok({ estimate: est, audience: kind });
    } catch (err) {
      return serverError("notifications:estimate", err);
    }
  }
  // Phase 18c-step3 — server-side filters (bounded). Invalid channel/status/
  // priority values are rejected (never silently ignored).
  const channel = params.get("channel");
  if (channel !== null && !(DELIVERY_CHANNELS as readonly string[]).includes(channel)) {
    return fail("Unknown channel filter. Use SMS, PUSH or IN_APP.", 400, "NOTIFY_BAD_FILTER");
  }
  const status = params.get("status");
  if (status !== null && !(HEADER_STATUSES as readonly string[]).includes(status) && !(DELIVERY_STATUSES as readonly string[]).includes(status)) {
    return fail("Unknown status filter.", 400, "NOTIFY_BAD_FILTER");
  }
  const priority = params.get("priority");
  if (priority !== null && !(PRIORITIES as readonly string[]).includes(priority)) {
    return fail("Unknown priority filter.", 400, "NOTIFY_BAD_FILTER");
  }
  const event = params.get("event");
  if (event !== null && !isKnownEvent(event)) {
    return fail("Unknown event filter.", 400, "NOTIFY_BAD_FILTER");
  }
  const recipient = (params.get("recipient") ?? "").trim().slice(0, 120);
  const dateStr = params.get("date");
  let dayStart: Date | null = null;
  let dayEnd: Date | null = null;
  if (dateStr) {
    const d = parseDate(dateStr);
    if (!d) return fail("Invalid date filter (use YYYY-MM-DD).", 400, "NOTIFY_BAD_FILTER");
    dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  }
  const failedOnly = params.get("failedOnly") === "1" || params.get("failedOnly") === "true";
  // Phase 15 — bounded history (default 100, max 200 preserves prior ceiling).
  const rawLimit = Number(params.get("limit"));
  const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.floor(rawLimit))) : 100;
  const rawOffset = Number(params.get("offset"));
  const offset = Number.isFinite(rawOffset) ? Math.min(5000, Math.max(0, Math.floor(rawOffset))) : 0;
  // Phase 18c-step5 (P1): channel/priority/delivery-status/failedOnly/
  // recipient filters all depend on the delivery-audit schema. When the
  // generated client has no delivery model, those filters cannot be applied
  // — say so explicitly (409) instead of returning unfiltered rows as
  // filtered. Header-status/date/event filters work on any schema.
  const deliveryStatusFilter = status !== null && (DELIVERY_STATUSES as readonly string[]).includes(status) ? status : null;
  const needsAuditForFilters = Boolean(channel || priority || deliveryStatusFilter || failedOnly || recipient);
  if (needsAuditForFilters && !isDeliveryModelAvailable(db)) {
    return fail(
      "The requested audit filters need the notification delivery schema, which is unavailable. Apply the pending Prisma migration and regenerate the client.",
      409,
      "DELIVERY_AUDIT_UNAVAILABLE"
    );
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (event) where.type = event;
    if (priority) where.priority = priority;
    if (status && (HEADER_STATUSES as readonly string[]).includes(status)) where.status = status;
    if (dayStart && dayEnd) where.createdAt = { gte: dayStart, lt: dayEnd };
    if (channel) where.requestedChannels = { has: channel };
    // Delivery-status / recipient / failedOnly need relational filters.
    if (deliveryStatusFilter) where.deliveries = { some: { status: deliveryStatusFilter } };
    if (failedOnly) where.deliveries = { ...(where.deliveries ?? {}), some: { status: "FAILED" } };
    if (recipient) {
      where.OR = [
        { targetUserId: recipient },
        { targetStudentId: recipient },
        { targetFacultyId: recipient },
        { deliveries: { some: { recipientKey: { contains: recipient } } } },
      ];
    }
    let rows: {
      id: string;
      title: string;
      message: string;
      audience: string;
      type: string;
      status: string;
      createdAt: Date;
      scheduledAt: Date | null;
      sentAt: Date | null;
      priority?: string;
      requestedChannels?: string[];
    }[];
    try {
      rows = await db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      });
    } catch (err) {
      // Phase 18c-step5 (P1): never fall back to an unfiltered query when
      // filters were requested. Distinguish schema/filter unavailability from
      // an unrelated outage with a minimal probe: if a trivial header read
      // succeeds, the database is reachable and the failure is the
      // delivery-audit schema — report 409. Otherwise surface the real error.
      if (needsAuditForFilters) {
        try {
          await db.notification.findFirst({ select: { id: true } });
          return fail(
            "The requested audit filters could not be applied because the notification delivery schema is unavailable. Apply the pending Prisma migration and regenerate the client.",
            409,
            "DELIVERY_AUDIT_UNAVAILABLE"
          );
        } catch {
          /* probe failed too — fall through to serverError below */
        }
      }
      return serverError("notifications:list", err);
    }
    const filtered = rows;
    const ids = filtered.map((n) => n.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { counts, audit, reason } = await deliveryCountsFor(db as any, ids);
    const items: HistoryRow[] = filtered.map((n) => {
      const c = counts.get(n.id) ?? { recipientCount: 0, smsSent: 0, smsFailed: 0, pushSent: 0, pushFailed: 0, inAppCount: 0 };
      const reqChannels: string[] = Array.isArray((n as { requestedChannels?: unknown }).requestedChannels)
        ? ((n as { requestedChannels?: string[] }).requestedChannels as string[])
        : [];
      const prio = typeof (n as { priority?: unknown }).priority === "string" ? String((n as { priority?: string }).priority) : "NORMAL";
      return {
        id: n.id,
        title: n.title,
        message: n.message,
        audience: audienceLabel(String(n.audience)),
        date: new Date(n.createdAt).toISOString().slice(0, 10),
        status: n.status === "SENT" ? "Sent" : n.status === "SCHEDULED" ? "Scheduled" : "Draft",
        event: String((n as { type?: string }).type ?? "general"),
        rawAudience: String(n.audience),
        priority: prio,
        channels: reqChannels,
        overallStatus: n.status,
        recipientCount: c.recipientCount,
        smsSent: c.smsSent,
        smsFailed: c.smsFailed,
        pushSent: c.pushSent,
        pushFailed: c.pushFailed,
        inAppCount: c.inAppCount,
        createdAt: new Date(n.createdAt).toISOString(),
        scheduledAt: n.scheduledAt ? new Date(n.scheduledAt).toISOString() : null,
        sentAt: n.sentAt ? new Date(n.sentAt).toISOString() : null,
      };
    });
    return ok({
      items,
      limit,
      offset,
      source: "database",
      // Phase 18c-step5 (P0): machine-readable audit availability. "ok" means
      // every count below was aggregated from persisted delivery rows.
      // "unavailable" (reason migration-missing|query-failed) means the numbers
      // are zero/partial and must not be treated as audited.
      deliveryAudit: audit,
      ...(audit === "unavailable" ? { deliveryAuditReason: reason } : {}),
      filtersApplied: true,
    });
  } catch (err) {
    return serverError("notifications:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Sending a notification");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["title", "message"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  // Legacy audience enum still accepted; engine kinds preferred.
  const rawAudience = typeof body.audience === "string" ? body.audience : "ALL_STUDENTS";
  const audienceKind: AudienceKind = (ENGINE_AUDIENCES as readonly string[]).includes(rawAudience)
    ? (rawAudience as AudienceKind)
    : AUDIENCES.includes(rawAudience as (typeof AUDIENCES)[number])
      ? (rawAudience as AudienceKind)
      : "ALL_STUDENTS";
  const event = typeof body.event === "string" && isKnownEvent(body.event) ? body.event : undefined;
  const templateKey = isSmsTemplateKey(body.templateKey) ? body.templateKey : undefined;
  // Phase 18c — the composer picks a template, not an event: derive the event
  // from a same-name template so pairing validation passes by construction.
  // Explicit mismatched event+template pairs are rejected by the engine.
  const resolvedEvent = event ?? (templateKey ? (eventForTemplate(templateKey) ?? "ADMIN_ANNOUNCEMENT") : "ADMIN_ANNOUNCEMENT");
  const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const vars =
    body.vars && typeof body.vars === "object" && !Array.isArray(body.vars)
      ? (body.vars as Record<string, unknown>)
      : {};
  // Phase 18c — idempotency keys are caller-provided, one per logical send,
  // and validated here (never a bare timestamp, bounded charset/length).
  const rawKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (body.idempotencyKey !== undefined && (rawKey.length === 0 || rawKey.length > 120 || !/^[A-Za-z0-9:_-]+$/.test(rawKey))) {
    return fail("idempotencyKey must be 1–120 chars of letters, digits, :, _ or -.", 400, "NOTIFY_BAD_KEY");
  }
  try {
    const report = await dispatchNotification(db, {
      event: resolvedEvent,
      actor: { id: auth.user.id, role: auth.user.role },
      audience: {
        kind: audienceKind,
        studentId: str(body.studentId) ?? str(body.targetStudentId),
        userId: str(body.userId) ?? str(body.targetUserId),
        facultyId: str(body.facultyId) ?? str(body.targetFacultyId),
        batchId: str(body.batchId) ?? str(body.targetBatchId),
      },
      title: String(body.title),
      message: String(body.message),
      templateKey,
      vars,
      priority: typeof body.priority === "string" ? body.priority : undefined,
      channels: body.channels,
      scheduledAt: body.sendNow === false || body.scheduledAt ? (parseDate(body.scheduledAt) ?? null) : null,
      idempotencyKey: rawKey ? rawKey : undefined,
      confirmMassSend: body.confirmMassSend === true,
    });
    if (!report.ok) {
      const status =
        report.code === "MASS_CONFIRM_REQUIRED"
          ? 403
          : report.code === "NOTIFY_BAD_EVENT" ||
              report.code === "NOTIFY_BAD_BODY" ||
              report.code === "NOTIFY_BAD_AUDIENCE" ||
              report.code === "NOTIFY_BAD_TEMPLATE" ||
              report.code === "NOTIFY_BAD_KEY"
            ? 400
            : 502;
      return fail(report.error ?? "Could not send the notification.", status, report.code);
    }
    return ok({ item: { id: report.inApp.id ?? null, scheduled: report.scheduled ?? false }, delivery: report }, 201);
  } catch (err) {
    return serverError("notifications:create", err);
  }
}
