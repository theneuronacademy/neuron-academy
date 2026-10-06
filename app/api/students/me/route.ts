// Phase 10 — own student profile (server-derived, never client ids).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Reading profile");
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT" && viewer.role !== "ADMIN") return fail("Forbidden.", 403);
  try {
    const student =
      viewer.role === "ADMIN"
        ? null
        : await db.student.findFirst({
            where: { OR: [{ userId: viewer.id }, { email: viewer.email.toLowerCase() }] },
            include: { batch: true, course: true },
          });
    if (!student) return fail("Student profile not found.", 404);
    return ok({
      item: {
        id: student.id,
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        phone: student.phone,
        batch: student.batch ? { id: student.batch.id, name: student.batch.name } : null,
        course: student.course ? { id: student.course.id, name: student.course.name } : null,
        joiningDate: student.joiningDate,
        status: student.status,
      },
    });
  } catch (err) {
    return serverError("students:me", err);
  }
}
