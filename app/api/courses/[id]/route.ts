// Phase 3 — Course detail API.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a course");
  try {
    const row = await db.course.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!row) return fail("Course not found.", 404);
    return ok({ item: row });
  } catch (err) {
    return serverError("courses:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a course");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const row = await db.course.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(typeof body.shortDescription === "string" ? { shortDescription: body.shortDescription } : {}),
        ...(typeof body.image === "string" ? { image: body.image } : {}),
        ...(typeof body.duration === "string" ? { duration: body.duration } : {}),
        ...(typeof body.fee === "number" ? { fee: body.fee } : {}),
        ...(body.status === "ACTIVE" || body.status === "INACTIVE" ? { status: body.status } : {}),
        ...(typeof body.displayOrder === "number" ? { displayOrder: body.displayOrder } : {}),
      },
    });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Course not found.", 404);
    return serverError("courses:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a course");
  try {
    // Phase 17 — destructive safety: dependents must be moved first.
    const [batches, students, enquiries] = await Promise.all([
      db.batch.count({ where: { courseId: id } }),
      db.student.count({ where: { courseId: id } }),
      db.enquiry.count({ where: { courseId: id } }),
    ]);
    if (batches + students + enquiries > 0) {
      return fail(
        `Cannot delete: this course has ${batches} batch(es), ${students} student(s) and ${enquiries} enquiry record(s). Reassign them or deactivate the course instead.`,
        409
      );
    }
    await db.course.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Course not found.", 404);
    return serverError("courses:delete", err);
  }
}
