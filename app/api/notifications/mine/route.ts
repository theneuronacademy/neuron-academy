// Phase 16 — per-user notification feed (in-app foundation).
// GET:   STUDENT → notifications targeted at them, their batch, or all
//        students (SENT only). FACULTY → own targeted (targetUserId AND
//        targetFacultyId) + faculty broadcasts + assigned-batch rows.
//        Includes per-user unreadCount. Broadcast reads use NotificationRead
//        receipts (one row per reader) so one student's read never clears
//        another recipient's unread state. Individually-targeted rows keep
//        the shared isRead flag (single recipient — safe) plus a receipt.
// PATCH: { id } marks one as read, { all: true } marks all visible as read.
//        Callers can only ever mark their OWN visible notifications.
//        Identity always derives from the session — never from the body.
// Phase 18c — faculty identity resolves to BOTH the session user id and the
// faculty profile id; the visibility scope includes rows targeted by either,
// so targetFacultyId notifications are never invisible. The profile id is
// session-derived, so no faculty can ever see another faculty's rows.
// Phase 18c-step3 — audit headers for SMS-only lanes exist (requestedChannels
// without IN_APP) but are hidden here in-memory: the in-app feed shows only
// IN_APP-capable rows (requestedChannels has IN_APP or legacy empty).
// Delivery audit rows (NotificationDelivery) are ADMIN-only and never
// exposed here.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { resolveStudent, facultyBatchIds } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shape(n: any, isRead: boolean) {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    testId: n.testId ?? null,
    isRead,
    createdAt: n.createdAt,
  };
}

// Phase 18c-step3 — in-app visibility: audit headers for SMS-only lanes
// (requestedChannels set without IN_APP) never appear in the feed.
// Legacy rows (no requestedChannels) stay visible. In-memory so pre-migration
// databases keep working.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isInAppVisible(n: any): boolean {
  const rc = (n as { requestedChannels?: unknown }).requestedChannels;
  if (rc === undefined || rc === null) return true;
  if (!Array.isArray(rc) || rc.length === 0) return true;
  return (rc as unknown[]).includes("IN_APP");
}

/** Parse ?limit= with safe bounds (default 50, max 100). */
function parseLimit(req: NextRequest, def: number, max: number): number {
  const raw = Number(new URL(req.url).searchParams.get("limit"));
  if (!Number.isFinite(raw)) return def;
  return Math.min(max, Math.max(1, Math.floor(raw)));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function readReceiptIds(db: Db, userId: string): Promise<Set<string>> {
  try {
    const rows = await db.notificationRead.findMany({
      where: { userId },
      select: { notificationId: true },
      take: 5000,
    });
    return new Set(rows.map((r: { notificationId: string }) => r.notificationId));
  } catch {
    return new Set();
  }
}

/** A row is individually targeted at this viewer (single recipient). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isIndividual(n: any, studentId: string | null, userId: string): boolean {
  return (studentId !== null && n.targetStudentId === studentId) || n.targetUserId === userId;
}

/** A row is individually targeted at this faculty viewer (own user id or own faculty profile id). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFacultyIndividual(n: any, facultyId: string | null, userId: string): boolean {
  return n.targetUserId === userId || (facultyId !== null && n.targetFacultyId === facultyId);
}

/** Resolve the faculty profile id for a session user (null when none). */
async function resolveFacultyId(db: Db, userId: string): Promise<string | null> {
  try {
    const row = await db.faculty.findUnique({ where: { userId }, select: { id: true } });
    return row?.id ?? null;
  } catch {
    return null;
  }
}

async function recordReads(
  db: Db,
  userId: string,
  notificationIds: string[],
  individualIds: string[]
): Promise<void> {
  if (notificationIds.length === 0 && individualIds.length === 0) return;
  // Per-user receipts (broadcast-safe). Skip-duplicates: re-reads are no-ops.
  if (notificationIds.length > 0) {
    try {
      await db.notificationRead.createMany({
        data: notificationIds.map((nid) => ({ notificationId: nid, userId })),
        skipDuplicates: true,
      });
    } catch {
      /* receipts table missing — individual flags below still apply */
    }
  }
  // Shared flag only for individually-targeted rows (single recipient).
  if (individualIds.length > 0) {
    await db.notification.updateMany({
      where: { id: { in: individualIds } },
      data: { isRead: true, readAt: new Date() },
    });
  }
}

export async function GET(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading notifications");
  const limit = parseLimit(req, 50, 100);
  try {
    if (viewer.role === "STUDENT") {
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      if (!profile) return ok({ items: [], unreadCount: 0, source: "database" });
      const where = {
        status: "SENT" as const,
        OR: [
          { targetStudentId: profile.id },
          { targetUserId: viewer.id },
          ...(profile.batchId ? [{ targetBatchId: profile.batchId }] : []),
          { audience: "ALL_STUDENTS" as const },
        ],
      };
      const [rows, receipts] = await Promise.all([
        db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
        readReceiptIds(db, viewer.id),
      ]);
      const visibleRows = rows.filter(isInAppVisible);
      const items = visibleRows.map((n) =>
        shape(n, receipts.has(n.id) || (isIndividual(n, profile.id, viewer.id) && n.isRead))
      );
      // Per-user unread: visible rows neither receipted nor (individual + globally read).
      // Count precisely over the bounded visible set; cap note when truncated.
      const visibleIds = await db.notification.findMany({
        where,
        select: { id: true, isRead: true, targetStudentId: true, targetUserId: true },
        orderBy: { createdAt: "desc" },
        take: 2000,
      });
      let unreadCount = 0;
      for (const v of visibleIds) {
        if (receipts.has(v.id)) continue;
        if (isIndividual(v, profile.id, viewer.id) && v.isRead) continue;
        const rc = (v as { requestedChannels?: unknown }).requestedChannels;
        if (Array.isArray(rc) && rc.length > 0 && !(rc as unknown[]).includes("IN_APP")) continue;
        unreadCount += 1;
      }
      return ok({ items, unreadCount, limit, source: "database" });
    }
    if (viewer.role === "FACULTY") {
      const batches = await facultyBatchIds(db, viewer.id);
      const facultyId = await resolveFacultyId(db, viewer.id);
      const where = {
        status: "SENT" as const,
        OR: [
          { targetUserId: viewer.id },
          ...(facultyId ? [{ targetFacultyId: facultyId }] : []),
          { audience: "FACULTY" as const },
          ...(batches.length > 0 ? [{ targetBatchId: { in: batches } }] : []),
        ],
      };
      const [rows, receipts] = await Promise.all([
        db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
        readReceiptIds(db, viewer.id),
      ]);
      const visibleRows = rows.filter(isInAppVisible);
      const items = visibleRows.map((n) =>
        shape(n, receipts.has(n.id) || (isFacultyIndividual(n, facultyId, viewer.id) && n.isRead))
      );
      const visibleIds = await db.notification.findMany({
        where,
        select: { id: true, isRead: true, targetUserId: true, targetFacultyId: true },
        orderBy: { createdAt: "desc" },
        take: 2000,
      });
      let unreadCount = 0;
      for (const v of visibleIds) {
        if (receipts.has(v.id)) continue;
        if (isFacultyIndividual(v, facultyId, viewer.id) && v.isRead) continue;
        const rc = (v as { requestedChannels?: unknown }).requestedChannels;
        if (Array.isArray(rc) && rc.length > 0 && !(rc as unknown[]).includes("IN_APP")) continue;
        unreadCount += 1;
      }
      return ok({ items, unreadCount, limit, source: "database" });
    }
    return fail("Forbidden.", 403);
  } catch (err) {
    return serverError("notifications:mine", err);
  }
}

export async function PATCH(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT" && viewer.role !== "FACULTY") return fail("Forbidden.", 403);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating notifications");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    if (viewer.role === "STUDENT") {
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      if (!profile) return fail("Student profile not found.", 403);
      const visible = {
        status: "SENT" as const,
        OR: [
          { targetStudentId: profile.id },
          { targetUserId: viewer.id },
          ...(profile.batchId ? [{ targetBatchId: profile.batchId }] : []),
          { audience: "ALL_STUDENTS" as const },
        ],
      };
      if (body.all === true) {
        // Phase 16 — receipts for everything visible; shared flag only for
        // individually-targeted rows (never corrupt broadcast state).
        const ids = await db.notification.findMany({
          where: visible,
          select: { id: true, targetStudentId: true, targetUserId: true },
          orderBy: { createdAt: "desc" },
          take: 2000,
        });
        const all = ids.map((n) => n.id);
        const indiv = ids.filter((n) => isIndividual(n, profile.id, viewer.id)).map((n) => n.id);
        await recordReads(db, viewer.id, all, indiv);
        return ok({ updated: true });
      }
      if (typeof body.id !== "string") return fail("id or all is required.", 400);
      const row = await db.notification.findFirst({
        where: { id: body.id, ...visible },
        select: { id: true, targetStudentId: true, targetUserId: true },
      });
      if (!row) return fail("Notification not found.", 404);
      await recordReads(
        db,
        viewer.id,
        [row.id],
        isIndividual(row, profile.id, viewer.id) ? [row.id] : []
      );
      return ok({ updated: true });
    }
    // FACULTY — same visibility scope as the GET feed (own user id + own
    // faculty profile id + FACULTY broadcasts + assigned-batch targets), so
    // mark-all clears everything the faculty member can see. Still strictly
    // limited to their own feed.
    const facultyBatches = await facultyBatchIds(db, viewer.id);
    const viewerFacultyId = await resolveFacultyId(db, viewer.id);
    const facultyVisible = {
      status: "SENT" as const,
      OR: [
        { targetUserId: viewer.id },
        ...(viewerFacultyId ? [{ targetFacultyId: viewerFacultyId }] : []),
        { audience: "FACULTY" as const },
        ...(facultyBatches.length > 0 ? [{ targetBatchId: { in: facultyBatches } }] : []),
      ],
    };
    if (body.all === true) {
      const ids = await db.notification.findMany({
        where: facultyVisible,
        select: { id: true, targetUserId: true, targetFacultyId: true },
        orderBy: { createdAt: "desc" },
        take: 2000,
      });
      const all = ids.map((n) => n.id);
      const indiv = ids.filter((n) => isFacultyIndividual(n, viewerFacultyId, viewer.id)).map((n) => n.id);
      await recordReads(db, viewer.id, all, indiv);
      return ok({ updated: true });
    }
    if (typeof body.id !== "string") return fail("id or all is required.", 400);
    const frow = await db.notification.findFirst({
      where: { id: body.id, ...facultyVisible },
      select: { id: true, targetUserId: true, targetFacultyId: true },
    });
    if (!frow) return fail("Notification not found.", 404);
    await recordReads(db, viewer.id, [frow.id], isFacultyIndividual(frow, viewerFacultyId, viewer.id) ? [frow.id] : []);
    return ok({ updated: true });
  } catch (err) {
    return serverError("notifications:mine-update", err);
  }
}
