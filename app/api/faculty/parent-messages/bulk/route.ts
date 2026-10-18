// Faculty Bulk Parent Report API - Send progress reports to all parents in a batch
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Sending bulk parent reports");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const missing = missingFields(body, ["batchId", "template"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);

  const { batchId, template } = body;

  // Verify faculty access
  if (auth.user.role === "FACULTY") {
    const allowed = await facultyBatchIds(db, auth.user.id);
    if (!allowed.includes(String(batchId))) return fail("Forbidden: batch not assigned to you.", 403);
  }

  // Get all students in batch with parent info
  const students = await db.student.findMany({
    where: { batchId: String(batchId), status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      studentId: true,
      parentName: true,
      parentMobile: true,
    },
  });

  if (students.length === 0) {
    return fail("No active students in this batch.", 404);
  }

  // Get analytics data for each student (attendance + avg score)
  const studentIds = students.map((s) => s.id);

  const [attendanceAgg, testResults] = await Promise.all([
    db.attendance.groupBy({
      by: ["studentId", "status"],
      where: { studentId: { in: studentIds } },
      _count: { status: true },
    }),
    db.result.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, percentage: true },
    }),
  ]);

  const perStudent = new Map<string, { attendancePct: number | null; avgScore: number | null }>();

  for (const s of students) {
    perStudent.set(s.id, { attendancePct: null, avgScore: null });
  }

  for (const a of attendanceAgg) {
    const cur = perStudent.get(a.studentId);
    if (!cur) continue;
    cur.attendancePct = cur.attendancePct ?? { present: 0, total: 0 } as unknown as number;
    // We need to track both present and total
  }

  // Recalculate properly
  const attendanceMap = new Map<string, { present: number; total: number }>();
  for (const a of attendanceAgg) {
    const cur = attendanceMap.get(a.studentId) ?? { present: 0, total: 0 };
    cur.total += a._count.status;
    if (a.status === "PRESENT" || a.status === "LATE") cur.present += a._count.status;
    attendanceMap.set(a.studentId, cur);
  }

  const scoreMap = new Map<string, number[]>();
  for (const r of testResults) {
    const cur = scoreMap.get(r.studentId) ?? [];
    cur.push(r.percentage ?? 0);
    scoreMap.set(r.studentId, cur);
  }

  // Template variables: {studentName}, {attendancePct}, {avgScore}, {batchName}
  const batch = await db.batch.findUnique({
    where: { id: String(batchId) },
    select: { name: true },
  });

  const batchName = batch?.name ?? "the batch";

  const results = await Promise.all(
    students.map(async (student) => {
      const att = attendanceMap.get(student.id);
      const attendancePct = att && att.total > 0 ? Math.round((att.present / att.total) * 1000) / 10 : null;

      const scores = scoreMap.get(student.id) ?? [];
      const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;

      const message = String(template)
        .replace(/\{studentName\}/g, student.name)
        .replace(/\{attendancePct\}/g, attendancePct?.toString() ?? "N/A")
        .replace(/\{avgScore\}/g, avgScore?.toString() ?? "N/A")
        .replace(/\{batchName\}/g, batchName);

      const subject = `Progress Update: ${student.name}`;

      // Create parent message record
      try {
        await db.parentMessage.create({
          data: {
            studentId: student.id,
            subject,
            message,
            channel: "IN_APP",
            status: "SENT",
          },
        });
      } catch {
        // Log error but continue
      }

      // TODO: Send actual SMS/Email if parentMobile/email exists
      // For now, just return the prepared messages

      return {
        studentId: student.id,
        studentName: student.name,
        parentName: student.parentName,
        parentMobile: student.parentMobile,
        subject,
        message,
        attendancePct,
        avgScore,
      };
    })
  );

  return ok({ sent: results.length, items: results });
}