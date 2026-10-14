// Phase 3 — Batch detail API.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { parseDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a batch");
  try {
    const row = await db.batch.findUnique({ where: { id }, include: { course: true, faculty: true } });
    if (!row) return fail("Batch not found.", 404);
    return ok({ item: row });
  } catch (err) {
    return serverError("batches:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a batch");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const row = await db.batch.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.facultyId === "string" ? { facultyId: body.facultyId || null } : {}),
        ...(body.startDate !== undefined ? { startDate: parseDate(body.startDate) ?? null } : {}),
        ...(body.endDate !== undefined ? { endDate: parseDate(body.endDate) ?? null } : {}),
        ...(body.status === "ACTIVE" || body.status === "UPCOMING" || body.status === "COMPLETED" ? { status: body.status } : {}),
      },
    });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Batch not found.", 404);
    return serverError("batches:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a batch");
  try {
    // Phase 17 — destructive safety: reassign or remove dependents first.
    const [students, tests, attendance] = await Promise.all([
      db.student.count({ where: { batchId: id } }),
      db.test.count({ where: { batchId: id } }),
      db.attendance.count({ where: { batchId: id } }),
    ]);
    if (students + tests + attendance > 0) {
      return fail(
        `Cannot delete: this batch has ${students} student(s), ${tests} test(s) and ${attendance} attendance record(s). Reassign them or mark the batch COMPLETED instead.`,
        409
      );
    }
    await db.batch.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Batch not found.", 404);
    return serverError("batches:delete", err);
  }
}
