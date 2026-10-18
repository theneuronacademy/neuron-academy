// Faculty Assignment Detail API - Update/Delete single assignment
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;

async function verifyFacultyAccess(db: ReturnType<typeof getDb>, userId: string, batchId: string) {
  const allowed = await facultyBatchIds(db, userId);
  return allowed.includes(batchId);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating assignment");

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const assignment = await db.assignment.findUnique({
    where: { id },
    select: { id: true, batchId: true },
  });

  if (!assignment) return fail("Assignment not found.", 404);

  // Verify faculty access
  if (auth.user.role === "FACULTY") {
    const hasAccess = await verifyFacultyAccess(db, auth.user.id, assignment.batchId);
    if (!hasAccess) return fail("Forbidden: assignment not in your assigned batches.", 403);
  }

  const { title, description, dueDate, maxMarks, weight, status } = body;

  if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
    return fail(`Invalid status. Must be one of: ${STATUSES.join(", ")}`, 400);
  }

  try {
    const updated = await db.assignment.update({
      where: { id },
      data: {
        ...(title && { title: String(title) }),
        ...(description !== undefined && { description: description ? String(description) : null }),
        ...(dueDate && { dueDate: new Date(String(dueDate)) }),
        ...(maxMarks !== undefined && { maxMarks: Number(maxMarks) }),
        ...(weight !== undefined && { weight: Number(weight) }),
        ...(status && { status: status as (typeof STATUSES)[number] }),
      },
      include: {
        batch: { select: { id: true, name: true } },
        test: { select: { id: true, title: true } },
      },
    });

    return ok({ item: updated });
  } catch (err) {
    return serverError("assignments:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting assignment");

  const { id } = await params;

  const assignment = await db.assignment.findUnique({
    where: { id },
    select: { id: true, batchId: true },
  });

  if (!assignment) return fail("Assignment not found.", 404);

  // Verify faculty access
  if (auth.user.role === "FACULTY") {
    const hasAccess = await verifyFacultyAccess(db, auth.user.id, assignment.batchId);
    if (!hasAccess) return fail("Forbidden: assignment not in your assigned batches.", 403);
  }

  try {
    await db.assignment.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    return serverError("assignments:delete", err);
  }
}