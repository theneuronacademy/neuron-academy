// Phase 13 — per-user notification feed (in-app foundation).
// GET:   STUDENT → notifications targeted at them, their batch, or all
//        students (SENT only). FACULTY → own targeted + faculty broadcasts.
//        Includes unreadCount. LocalStorage feed stays as offline fallback.
// PATCH: { id } marks one as read, { all: true } marks all visible as read.
//        Callers can only ever mark their OWN visible notifications.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { resolveStudent, facultyBatchIds } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shape(n: any) {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    testId: n.testId ?? null,
    isRead: n.isRead,
    createdAt: n.createdAt,
  };
}

/** Parse ?limit= with safe bounds (default 50, max 100). */
function parseLimit(req: NextRequest, def: number, max: number): number {
  const raw = Number(new URL(req.url).searchParams.get("limit"));
  if (!Number.isFinite(raw)) return def;
  return Math.min(max, Math.max(1, Math.floor(raw)));
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
      const [rows, unreadCount] = await Promise.all([
        db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
        db.notification.count({ where: { ...where, isRead: false } }),
      ]);
      return ok({ items: rows.map(shape), unreadCount, limit, source: "database" });
    }
    if (viewer.role === "FACULTY") {
      const batches = await facultyBatchIds(db, viewer.id);
      const where = {
        status: "SENT" as const,
        OR: [{ targetUserId: viewer.id }, { audience: "FACULTY" as const }, ...(batches.length > 0 ? [{ targetBatchId: { in: batches } }] : [])],
      };
      const [rows, unreadCount] = await Promise.all([
        db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
        db.notification.count({ where: { ...where, isRead: false } }),
      ]);
      return ok({ items: rows.map(shape), unreadCount, limit, source: "database" });
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
        await db.notification.updateMany({ where: { ...visible, isRead: false }, data: { isRead: true, readAt: new Date() } });
        return ok({ updated: true });
      }
      if (typeof body.id !== "string") return fail("id or all is required.", 400);
      const updated = await db.notification.updateMany({
        where: { id: body.id, ...visible },
        data: { isRead: true, readAt: new Date() },
      });
      if (updated.count === 0) return fail("Notification not found.", 404);
      return ok({ updated: true });
    }
    // FACULTY — same visibility scope as the GET feed (own + FACULTY
    // broadcasts + assigned-batch targets), so mark-all clears everything
    // the faculty member can see. Still strictly limited to their own feed.
    const facultyBatches = await facultyBatchIds(db, viewer.id);
    const facultyVisible = {
      status: "SENT" as const,
      OR: [
        { targetUserId: viewer.id },
        { audience: "FACULTY" as const },
        ...(facultyBatches.length > 0 ? [{ targetBatchId: { in: facultyBatches } }] : []),
      ],
    };
    if (body.all === true) {
      await db.notification.updateMany({
        where: { ...facultyVisible, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return ok({ updated: true });
    }
    if (typeof body.id !== "string") return fail("id or all is required.", 400);
    const updated = await db.notification.updateMany({
      where: { id: body.id, ...facultyVisible },
      data: { isRead: true, readAt: new Date() },
    });
    if (updated.count === 0) return fail("Notification not found.", 404);
    return ok({ updated: true });
  } catch (err) {
    return serverError("notifications:mine-update", err);
  }
}
