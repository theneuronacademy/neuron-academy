// Phase 5 — Test detail API.
// GET: ADMIN/FACULTY full; STUDENT only own-batch visible tests (no drafts).
// PATCH publish → database notification ("New test available").

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { batchAllowed, facultyBatchIds, resolveStudent, STUDENT_VISIBLE_STATUSES } from "@/lib/testAccess";
import { parseDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function facultyMayEdit(db: NonNullable<ReturnType<typeof getDb>>, userId: string, testId: string): Promise<boolean> {
  const t = await db.test.findUnique({ where: { id: testId }, select: { createdById: true, batchId: true } });
  if (!t) return true; // let the update itself 404
  if (t.createdById === userId) return true;
  if (t.batchId) {
    const allowed = await facultyBatchIds(db, userId);
    if (allowed.includes(t.batchId)) return true;
  }
  return false;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a test");
  try {
    const row = await db.test.findUnique({ where: { id }, include: { questions: { orderBy: { order: "asc" } }, batch: true } });
    if (!row) return fail("Test not found.", 404);
    const viewer = getUserFromRequest(req);
    if (viewer?.role === "STUDENT") {
      if (!STUDENT_VISIBLE_STATUSES.includes(row.status as (typeof STUDENT_VISIBLE_STATUSES)[number])) {
        return fail("Test not found.", 404);
      }
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      if (!profile || profile.status !== "ACTIVE" || !batchAllowed(profile.batchId, row.batchId)) {
        return fail("Test not found.", 404);
      }
    }
    return ok({ item: row });
  } catch (err) {
    return serverError("tests:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a test");
  if (auth.user.role === "FACULTY" && !(await facultyMayEdit(db, auth.user.id, id))) {
    return fail("You can edit only your own or assigned-batch tests.", 403);
  }
  if (!db) return dbNotConfigured("Updating a test");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const row = await db.test.update({
      where: { id },
      data: {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(typeof body.batchId === "string" ? { batchId: body.batchId || null } : {}),
        ...(body.type === "LIVE" || body.type === "OFFLINE" || body.type === "PRACTICE" ? { type: body.type } : {}),
        ...(typeof body.duration === "number" ? { duration: body.duration } : {}),
        ...(typeof body.totalMarks === "number" ? { totalMarks: body.totalMarks } : {}),
        ...(body.startTime !== undefined ? { startTime: parseDate(body.startTime) ?? null } : {}),
        ...(body.endTime !== undefined ? { endTime: parseDate(body.endTime) ?? null } : {}),
        ...(body.status === "DRAFT" || body.status === "SCHEDULED" || body.status === "LIVE" || body.status === "COMPLETED" || body.status === "PUBLISHED"
          ? { status: body.status }
          : {}),
      },
    });
    // Publish → database notification for the batch (push provider consumes later).
    if (body.status === "PUBLISHED") {
      try {
        await db.notification.create({
          data: {
            title: "New test available",
            message: `${row.title} is now available.`,
            type: "test",
            audience: row.batchId ? "BATCH" : "ALL_STUDENTS",
            targetBatchId: row.batchId,
            createdById: auth.user.id,
            sentAt: new Date(),
            status: "SENT",
          },
        });
      } catch {
        /* notification must never fail publishing */
      }
    }
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Test not found.", 404);
    return serverError("tests:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a test");
  if (auth.user.role === "FACULTY" && !(await facultyMayEdit(db, auth.user.id, id))) {
    return fail("You can delete only your own or assigned-batch tests.", 403);
  }
  try {
    await db.test.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Test not found.", 404);
    return serverError("tests:delete", err);
  }
}
