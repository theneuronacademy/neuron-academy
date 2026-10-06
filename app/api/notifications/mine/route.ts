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

export async function GET(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading notifications");
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
        db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
        db.notification.count({ where: { ...where, isRead: false } }),
      ]);
      return ok({ items: rows.map(shape), unreadCount, source: "database" });
    }
    if (viewer.role === "FACULTY") {
      const batches = await facultyBatchIds(db, viewer.id);
      const where = {
        status: "SENT" as const,
        OR: [{ targetUserId: viewer.id }, { audience: "FACULTY" as const }, ...(batches.length > 0 ? [{ targetBatchId: { in: batches } }] : [])],
      };
      const [rows, unreadCount] = await Promise.all([
        db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
        db.notification.count({ where: { ...where, isRead: false } }),
      ]);
      return ok({ items: rows.map(shape), unreadCount, source: "database" });
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
    // FACULTY
    if (body.all === true) {
      await db.notification.updateMany({
        where: { status: "SENT", OR: [{ targetUserId: viewer.id }, { audience: "FACULTY" }] },
        data: { isRead: true, readAt: new Date() },
      });
      return ok({ updated: true });
    }
    if (typeof body.id !== "string") return fail("id or all is required.", 400);
    const updated = await db.notification.updateMany({
      where: { id: body.id, status: "SENT", OR: [{ targetUserId: viewer.id }, { audience: "FACULTY" }] },
      data: { isRead: true, readAt: new Date() },
    });
    if (updated.count === 0) return fail("Notification not found.", 404);
    return ok({ updated: true });
  } catch (err) {
    return serverError("notifications:mine-update", err);
  }
}
