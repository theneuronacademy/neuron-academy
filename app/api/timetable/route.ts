// Class timetable.
// GET  /api/timetable — STUDENT: own batch grid; FACULTY: own classes;
//   ADMIN: ?batchId= filter or all (take 500).
// POST /api/timetable — ADMIN: { batchId, subject, title?, facultyId?,
//   dayOfWeek 0-6, startTime/endTime "HH:MM", room? }.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds, resolveStudent } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading timetable");
  try {
    const q = new URL(req.url).searchParams;
    if (viewer.role === "STUDENT") {
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      if (!profile?.batchId) return ok({ items: [], source: "database" });
      const items = await db.timetableEntry.findMany({
        where: { batchId: profile.batchId, isActive: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        include: { faculty: { select: { name: true } } },
      });
      return ok({ items, source: "database" });
    }
    if (viewer.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, viewer.id);
      const me = await db.faculty.findFirst({ where: { userId: viewer.id }, select: { id: true } });
      const items = await db.timetableEntry.findMany({
        where: {
          isActive: true,
          OR: [{ batchId: { in: allowed.length ? allowed : ["__none__"] } }, ...(me ? [{ facultyId: me.id }] : []),
          ],
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        include: { batch: { select: { name: true } }, faculty: { select: { name: true } } },
      });
      return ok({ items, source: "database" });
    }
    if (viewer.role !== "ADMIN") return fail("Forbidden.", 403);
    const batchId = q.get("batchId") ?? "";
    const items = await db.timetableEntry.findMany({
      where: batchId ? { batchId } : {},
      orderBy: [{ batchId: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
      take: 500,
      include: { batch: { select: { name: true } }, faculty: { select: { name: true } } },
    });
    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("timetable:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating timetable entry");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const batchId = typeof body.batchId === "string" ? body.batchId.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const dayOfWeek = Number(body.dayOfWeek);
  const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
  const endTime = typeof body.endTime === "string" ? body.endTime.trim() : "";
  if (!batchId) return fail("batchId is required.", 400);
  if (!subject) return fail("subject is required.", 400);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return fail("dayOfWeek must be 0 (Sun) – 6 (Sat).", 400);
  }
  if (!TIME.test(startTime) || !TIME.test(endTime) || startTime >= endTime) {
    return fail("startTime/endTime must be HH:MM with start < end.", 400);
  }
  try {
    const batch = await db.batch.findUnique({ where: { id: batchId }, select: { id: true } });
    if (!batch) return fail("Batch not found.", 404);
    let facultyId: string | undefined;
    if (typeof body.facultyId === "string" && body.facultyId.trim()) {
      const f = await db.faculty.findUnique({ where: { id: body.facultyId.trim() }, select: { id: true } });
      if (!f) return fail("Faculty not found.", 404);
      facultyId = f.id;
    }
    const created = await db.timetableEntry.create({
      data: {
        batchId,
        subject,
        title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : null,
        facultyId,
        dayOfWeek,
        startTime,
        endTime,
        room: typeof body.room === "string" && body.room.trim() ? body.room.trim().slice(0, 60) : null,
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("timetable:create", err);
  }
}
