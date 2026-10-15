// Single timetable entry — ADMIN-only edits.
// PATCH /api/timetable/[id] — { subject?, title?, facultyId?, dayOfWeek?,
//   startTime?, endTime?, room?, isActive? } (same validation as create).
// DELETE /api/timetable/[id] — remove entry.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating timetable entry");
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const update: Record<string, unknown> = {};
  if (typeof body.subject === "string" && body.subject.trim()) update.subject = body.subject.trim().slice(0, 80);
  if (body.title !== undefined) {
    update.title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : null;
  }
  if (body.facultyId !== undefined) {
    if (typeof body.facultyId === "string" && body.facultyId.trim()) {
      const f = await db.faculty.findUnique({ where: { id: body.facultyId.trim() }, select: { id: true } });
      if (!f) return fail("Faculty not found.", 404);
      update.facultyId = f.id;
    } else update.facultyId = null;
  }
  if (body.dayOfWeek !== undefined) {
    const d = Number(body.dayOfWeek);
    if (!Number.isInteger(d) || d < 0 || d > 6) return fail("dayOfWeek must be 0–6.", 400);
    update.dayOfWeek = d;
  }
  const timePatch: Record<string, string> = {};
  for (const k of ["startTime", "endTime"] as const) {
    if (body[k] !== undefined) {
      if (typeof body[k] !== "string" || !TIME.test((body[k] as string).trim())) {
        return fail(`${k} must be HH:MM.`, 400);
      }
      timePatch[k] = (body[k] as string).trim();
    }
  }
  if (typeof body.room === "string") update.room = body.room.trim() ? body.room.trim().slice(0, 60) : null;
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;
  if (Object.keys(update).length === 0 && Object.keys(timePatch).length === 0) {
    return fail("No valid update fields provided.", 400);
  }
  try {
    const current = await db.timetableEntry.findUnique({ where: { id }, select: { startTime: true, endTime: true } });
    if (!current) return fail("Timetable entry not found.", 404);
    const start = timePatch.startTime ?? current.startTime;
    const end = timePatch.endTime ?? current.endTime;
    if (start >= end) return fail("startTime must be before endTime.", 400);
    const item = await db.timetableEntry.update({ where: { id }, data: { ...update, ...timePatch } });
    return ok({ item });
  } catch (err) {
    return serverError("timetable:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting timetable entry");
  const { id } = await params;
  try {
    await db.timetableEntry.delete({ where: { id } });
    return ok({ deleted: true });
  } catch {
    return fail("Timetable entry not found.", 404);
  }
}
