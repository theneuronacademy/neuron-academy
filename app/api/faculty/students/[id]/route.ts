// Single-student 360° view (FACULTY, assigned batches only).
// GET /api/faculty/students/[id] — profile + recent results + attendance
// summary + attempt counts. Every row is session-scoped; students outside
// the caller's batches return 404 (no enumeration, no leakage).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading student profile");
  const { id } = await params;
  try {
    const allowed = await facultyBatchIds(db, auth.user.id);
    const student = await db.student.findUnique({
      where: { id },
      select: {
        id: true,
        studentId: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        studentType: true,
        batchId: true,
        parentName: true,
        parentMobile: true,
        batch: { select: { id: true, name: true } },
      },
    });
    if (!student || !student.batchId || !allowed.includes(student.batchId)) {
      return fail("Student not found.", 404);
    }
    const [results, attendance, attempts] = await Promise.all([
      db.result.findMany({
        where: { studentId: id },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { id: true, testId: true, marks: true, totalMarks: true, percentage: true, updatedAt: true, test: { select: { title: true } } },
      }),
      db.attendance.groupBy({ by: ["status"], where: { studentId: id }, _count: { status: true } }),
      db.testAttempt.groupBy({ by: ["status"], where: { studentId: id }, _count: { status: true } }),
    ]);
    const att = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    for (const g of attendance) att[g.status as keyof typeof att] = g._count.status;
    const attTotal = att.PRESENT + att.ABSENT + att.LATE + att.LEAVE;
    const percentages = results.map((r) => r.percentage);
    return ok({
      student,
      results,
      attendance: {
        ...att,
        total: attTotal,
        percentage: attTotal > 0 ? Math.round(((att.PRESENT + att.LATE * 0.5) / attTotal) * 1000) / 10 : null,
      },
      attempts: attempts.map((a) => ({ status: a.status, count: a._count.status })),
      avgScore:
        percentages.length > 0
          ? Math.round((percentages.reduce((s, p) => s + p, 0) / percentages.length) * 10) / 10
          : null,
      source: "database",
    });
  } catch (err) {
    return serverError("faculty:student360", err);
  }
}
