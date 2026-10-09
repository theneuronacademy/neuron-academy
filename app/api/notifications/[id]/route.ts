// Phase 3 — Notification detail API.
// Phase 18c-step3 — ADMIN-only delivery audit: NOTIFICATION header +
// DELIVERY SUMMARY (aggregated from persisted NotificationDelivery rows) +
// paginated RECIPIENT DETAILS (bounded, safe fields only — never secrets,
// OTPs, phones beyond admin-visible identity, or raw provider payloads).
// Clients cannot modify delivery status and cannot create delivery records:
// only GET (audit) here; PATCH stays header-only and never touches SENT.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const DELIVERY_CHANNELS = ["SMS", "PUSH", "IN_APP"] as const;
const DELIVERY_STATUSES = ["CREATED", "QUEUED", "PROCESSING", "SENT", "DELIVERED", "FAILED", "RETRYING", "SKIPPED"] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a notification");
  const q = new URL(req.url).searchParams;
  const channel = q.get("channel");
  if (channel !== null && !(DELIVERY_CHANNELS as readonly string[]).includes(channel)) {
    return fail("Unknown channel filter. Use SMS, PUSH or IN_APP.", 400, "NOTIFY_BAD_FILTER");
  }
  const status = q.get("status");
  if (status !== null && !(DELIVERY_STATUSES as readonly string[]).includes(status)) {
    return fail("Unknown delivery status filter.", 400, "NOTIFY_BAD_FILTER");
  }
  const failedOnly = q.get("failedOnly") === "1" || q.get("failedOnly") === "true";
  const recipient = (q.get("recipient") ?? "").trim().slice(0, 120);
  const rawLimit = Number(q.get("limit"));
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 50;
  const rawOffset = Number(q.get("offset"));
  const offset = Number.isFinite(rawOffset) ? Math.min(5000, Math.max(0, Math.floor(rawOffset))) : 0;
  try {
    const row = await db.notification.findUnique({ where: { id } });
    if (!row) return fail("Notification not found.", 404);
    // Delivery summary + recipient rows come ONLY from persisted delivery
    // data (never invented). Bounded: groupBy counts + paginated rows.
    // Phase 18c-step5 (P0): track audit availability explicitly. A missing
    // delivery model means the migration is not applied (migration-missing);
    // a throw with the model present is a query failure (query-failed) — the
    // two are never conflated, and zeroes are never presented as audited.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyDb = db as any;
    const summary = {
      sms: { total: 0, sent: 0, failed: 0, skipped: 0, retryable: 0 },
      push: { total: 0, sent: 0, failed: 0, skipped: 0 },
      inApp: { total: 0, delivered: 0, failed: 0 },
    };
    let deliveries: unknown[] = [];
    let deliveryTotal = 0;
    let deliveryAudit: "ok" | "unavailable" = "ok";
    let deliveryAuditReason: null | "migration-missing" | "query-failed" = null;
    if (!anyDb.notificationDelivery?.groupBy) {
      deliveryAudit = "unavailable";
      deliveryAuditReason = "migration-missing";
    } else {
      try {
        const groups = await anyDb.notificationDelivery.groupBy({
          by: ["channel", "status"],
          where: { notificationId: id },
          _count: { _all: true },
        });
        for (const g of groups as { channel: string; status: string; _count: { _all: number } }[]) {
          const n = g._count?._all ?? 0;
          if (g.channel === "SMS") {
            summary.sms.total += n;
            if (g.status === "SENT") summary.sms.sent += n;
            if (g.status === "FAILED") summary.sms.failed += n;
            if (g.status === "SKIPPED") summary.sms.skipped += n;
          }
          if (g.channel === "PUSH") {
            summary.push.total += n;
            if (g.status === "SENT") summary.push.sent += n;
            if (g.status === "FAILED") summary.push.failed += n;
            if (g.status === "SKIPPED") summary.push.skipped += n;
          }
          if (g.channel === "IN_APP") {
            // Phase 18c-step5 (P2): the engine only ever writes DELIVERED for
            // IN_APP; SENT is counted too so a future provider receipt that
            // lands as SENT is not silently dropped from the audit.
            summary.inApp.total += n;
            if (g.status === "DELIVERED" || g.status === "SENT") summary.inApp.delivered += n;
            if (g.status === "FAILED") summary.inApp.failed += n;
          }
        }
        // Retryable SMS count (foundation for the future worker).
        try {
          summary.sms.retryable = await anyDb.notificationDelivery.count({
            where: { notificationId: id, channel: "SMS", retryable: true },
          });
        } catch {
          deliveryAudit = "unavailable";
          deliveryAuditReason = "query-failed";
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dw: any = { notificationId: id };
        if (channel) dw.channel = channel;
        if (failedOnly) dw.status = "FAILED";
        else if (status) dw.status = status;
        if (recipient) dw.recipientKey = { contains: recipient };
        try {
          deliveryTotal = await anyDb.notificationDelivery.count({ where: dw });
        } catch {
          deliveryAudit = "unavailable";
          deliveryAuditReason = "query-failed";
        }
        try {
          const drows = await anyDb.notificationDelivery.findMany({
            where: dw,
            select: {
              id: true,
              channel: true,
              status: true,
              priority: true,
              provider: true,
              providerMessageId: true,
              errorCode: true,
              errorMessage: true,
              retryable: true,
              attemptCount: true,
              recipientKey: true,
              userId: true,
              studentId: true,
              facultyId: true,
              queuedAt: true,
              sentAt: true,
              deliveredAt: true,
              failedAt: true,
              lastAttemptAt: true,
              nextAttemptAt: true,
              createdAt: true,
              user: { select: { id: true, name: true, email: true, role: true } },
            },
            orderBy: { createdAt: "asc" },
            skip: offset,
            take: limit,
          });
          deliveries = drows;
        } catch {
          deliveries = [];
          deliveryAudit = "unavailable";
          deliveryAuditReason = "query-failed";
        }
      } catch {
        deliveryAudit = "unavailable";
        deliveryAuditReason = "query-failed";
      }
    }
    const r = row as unknown as Record<string, unknown>;
    return ok({
      item: {
        id: row.id,
        event: String(r.type ?? "general"),
        title: row.title,
        message: row.message,
        priority: typeof r.priority === "string" ? r.priority : "NORMAL",
        audience: row.audience,
        channels: Array.isArray(r.requestedChannels) ? r.requestedChannels : [],
        status: row.status,
        created: row.createdAt,
        scheduled: (row as { scheduledAt?: unknown }).scheduledAt ?? null,
        sent: (row as { sentAt?: unknown }).sentAt ?? null,
      },
      deliverySummary: summary,
      deliveries,
      deliveryPagination: { total: deliveryTotal, limit, offset },
      deliveryAudit,
      ...(deliveryAudit === "unavailable" ? { deliveryAuditReason } : {}),
    });
  } catch (err) {
    return serverError("notifications:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a notification");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    // Phase 18c — lifecycle guard: PATCH never delivers. A notification must
    // NEVER become SENT merely because an admin changed its status — sending
    // happens only via POST through the notification engine (channel routing,
    // policy, idempotency, delivery reports). SCHEDULED is never promoted to
    // SENT here either; only the future scheduler executes schedules.
    // Allowed: DRAFT ↔ SCHEDULED transitions plus title/message edits on
    // unsent rows. SENT rows are immutable.
    const existing = await db.notification.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) return fail("Notification not found.", 404);
    if (existing.status === "SENT") {
      return fail("Sent notifications are immutable. Create a new notification via POST to send again.", 409, "NOTIFY_IMMUTABLE");
    }
    if (body.status !== undefined) {
      const next = body.status;
      const allowed =
        (existing.status === "DRAFT" && next === "SCHEDULED") ||
        (existing.status === "SCHEDULED" && next === "DRAFT");
      if (!allowed) {
        return fail(
          "Status cannot be changed to SENT or across delivered states here. Send via POST through the engine.",
          400,
          "NOTIFY_BAD_TRANSITION"
        );
      }
    }
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : undefined;
    const message = typeof body.message === "string" && body.message.trim() ? body.message.trim().slice(0, 1000) : undefined;
    const row = await db.notification.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(message !== undefined ? { message } : {}),
        ...(body.status === "DRAFT" || body.status === "SCHEDULED" ? { status: body.status } : {}),
      },
    });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Notification not found.", 404);
    return serverError("notifications:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a notification");
  try {
    await db.notification.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Notification not found.", 404);
    return serverError("notifications:delete", err);
  }
}
