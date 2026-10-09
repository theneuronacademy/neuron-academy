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
    // Phase 14 — type + profile + activity for the upgraded console.
    studentType: s.studentType ?? "REGULAR",
    photoUrl: s.photoUrl ?? s.photo ?? null,
    gender: s.gender ?? null,
    address: s.address ?? null,
    city: s.city ?? null,
    school: s.school ?? null,
    className: s.className ?? null,
    parentName: s.parentName ?? null,
    parentMobile: s.parentMobile ?? null,
    dob: s.dob ?? null,
    enrollmentDate: s.enrollmentDate ?? s.joiningDate ?? null,
    lastLoginAt: s.lastLoginAt ?? null,
    batchId: s.batchId ?? null,
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
  // Phase 14 — admin-managed type + profile fields (type change takes effect
  // immediately — every route reads studentType from the DB per request).
  if (body.studentType !== undefined && body.studentType !== "REGULAR" && body.studentType !== "SCHOLARSHIP") {
    return fail("studentType must be REGULAR or SCHOLARSHIP.", 400);
  }
  if (body.batchId !== undefined && body.batchId !== "" && body.batchId !== null) {
    const batch = await db.batch.findUnique({ where: { id: String(body.batchId) }, select: { id: true } }).catch(() => null);
    if (!batch) return fail("Batch not found.", 404);
  }
  const str = (v: unknown, max: number): string | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
  };
  try {
    const current = await db.student.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!current) return fail("Student not found.", 404);
    // Unique mobile/email guard (excluding self).
    if (typeof body.phone === "string" && body.phone) {
      const clash = await db.student.findFirst({ where: { phone: body.phone, NOT: { id } }, select: { id: true } });
      if (clash) return fail("This mobile number is already registered.", 409);
    }
    if (typeof body.email === "string" && body.email) {
      const clash = await db.student.findFirst({ where: { email: body.email.toLowerCase(), NOT: { id } }, select: { id: true } });
      if (clash) return fail("This email is already registered.", 409);
    }
    const row = await db.student.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.email === "string" && body.email ? { email: body.email.toLowerCase() } : {}),
        ...(typeof body.phone === "string" ? { phone: body.phone } : {}),
        ...(typeof body.batchId === "string" || body.batchId === null ? { batchId: (body.batchId as string) || null } : {}),
        ...(typeof body.courseId === "string" ? { courseId: body.courseId || null } : {}),
        ...(body.status === "ACTIVE" || body.status === "INACTIVE" ? { status: body.status } : {}),
        ...(body.studentType === "REGULAR" || body.studentType === "SCHOLARSHIP" ? { studentType: body.studentType } : {}),
        ...(str(body.gender, 16) !== undefined ? { gender: str(body.gender, 16) } : {}),
        ...(str(body.address, 300) !== undefined ? { address: str(body.address, 300) } : {}),
        ...(str(body.city, 80) !== undefined ? { city: str(body.city, 80) } : {}),
        ...(str(body.school, 120) !== undefined ? { school: str(body.school, 120) } : {}),
        ...(str(body.className, 40) !== undefined ? { className: str(body.className, 40) } : {}),
        ...(str(body.parentName, 80) !== undefined ? { parentName: str(body.parentName, 80) } : {}),
        ...(str(body.parentMobile, 20) !== undefined ? { parentMobile: str(body.parentMobile, 20) } : {}),
      },
      include: { batch: true, course: true },
    });
    if (typeof body.name === "string" && current.userId) {
      await db.user.update({ where: { id: current.userId }, data: { name: body.name } }).catch(() => null);
    }
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
    // Phase 17 — destructive safety: never silently orphan production
    // history. Deactivate instead when dependent records exist.
    const [results, attendance, attempts, grants] = await Promise.all([
      db.result.count({ where: { studentId: id } }),
      db.attendance.count({ where: { studentId: id } }),
      db.testAttempt.count({ where: { studentId: id } }),
      db.testAccess.count({ where: { studentId: id } }),
    ]);
    const dependents = results + attendance + attempts + grants;
    if (dependents > 0) {
      return fail(
        `Cannot delete: this student has ${results} result(s), ${attendance} attendance record(s), ${attempts} attempt(s) and ${grants} access grant(s). Deactivate the student instead to preserve history.`,
        409
      );
    }
    await db.student.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Student not found.", 404);
    return serverError("students:delete", err);
  }
}
