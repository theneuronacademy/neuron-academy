// Phase 3 — Student detail API.
// TODO auth: enforce ADMIN role once the session layer lands.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { isEmail, isPhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAdmin(s: any) {
  return {
    id: s.id,
    studentId: s.studentId,
    name: s.name,
    email: s.email,
    phone: s.phone,
    batch: s.batch?.name ?? "—",
    course: s.course?.name ?? "—",
    joiningDate: s.joiningDate ? new Date(s.joiningDate).toISOString().slice(0, 10) : "",
    attendancePct: 0,
    avgScore: 0,
    status: String(s.status ?? "ACTIVE").toLowerCase() === "inactive" ? "inactive" : "active",
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a student");
  try {
    const row = await db.student.findUnique({ where: { id }, include: { batch: true, course: true } });
    if (!row) return fail("Student not found.", 404);
    return ok({ item: toAdmin(row) });
  } catch (err) {
    return serverError("students:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a student");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  if (body.email !== undefined && body.email !== "" && !isEmail(body.email)) return fail("Invalid email.", 400);
  if (body.phone !== undefined && !isPhone(body.phone)) return fail("Invalid phone.", 400);
  try {
    const row = await db.student.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.email === "string" && body.email ? { email: body.email } : {}),
        ...(typeof body.phone === "string" ? { phone: body.phone } : {}),
        ...(typeof body.batchId === "string" ? { batchId: body.batchId || null } : {}),
        ...(typeof body.courseId === "string" ? { courseId: body.courseId || null } : {}),
        ...(body.status === "ACTIVE" || body.status === "INACTIVE" ? { status: body.status } : {}),
      },
      include: { batch: true, course: true },
    });
    return ok({ item: toAdmin(row) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Student not found.", 404);
    return serverError("students:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a student");
  try {
    await db.student.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Student not found.", 404);
    return serverError("students:delete", err);
  }
}
