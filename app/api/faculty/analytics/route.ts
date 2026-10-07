import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["FACULTY", "ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading faculty analytics");
  try {
    const batchIds = auth.user.role === "ADMIN"
      ? (await db.batch.findMany({ select: { id: true }, take: 500 })).map((b) => b.id)
      : await facultyBatchIds(db, auth.user.id);
    if (batchIds.length === 0) {
      return ok({ batches: [], overall: { students: 0, attendancePct: null, avgScore: null, testsTaken: 0 } });
    }
    const students = await db.student.findMany({
      where: { batchId: { in: batchIds }, status: "ACTIVE" },
      select: { id: true, name: true, batchId: true, batch: { select: { name: true } } },
      take: 500,
    });
    const studentIds = students.map((s) => s.id);
    const [attAgg, results] = await Promise.all([
      studentIds.length
        ? db.attendance.groupBy({ by: ["studentId", "status"], where: { studentId: { in: studentIds } }, _count: { status: true } })
        : [],
      studentIds.length
        ? db.result.findMany({ where: { studentId: { in: studentIds } }, select: { studentId: true, percentage: true, testId: true } })
        : [],
    ]);
    const perStudent = new Map<string, { present: number; total: number; scores: number[] }>();
    for (const s of students) perStudent.set(s.id, { present: 0, total: 0, scores: [] });
    for (const a of attAgg) {
      const cur = perStudent.get(a.studentId);
      if (!cur) continue;
      cur.total += a._count.status;
      if (a.status === "PRESENT" || a.status === "LATE") cur.present += a._count.status;
    }
    for (const r of results) {
      const cur = perStudent.get(r.studentId);
      if (cur) cur.scores.push(r.percentage ?? 0);
    }
    const rows = students.map((s) => {
      const cur = perStudent.get(s.id) ?? { present: 0, total: 0, scores: [] };
      const attendancePct = cur.total > 0 ? Math.round((cur.present / cur.total) * 1000) / 10 : null;
      const avgScore = cur.scores.length > 0 ? Math.round((cur.scores.reduce((a, b) => a + b, 0) / cur.scores.length) * 10) / 10 : null;
      return { id: s.id, name: s.name, batch: s.batch?.name ?? "—", batchId: s.batchId, attendancePct, testsTaken: cur.scores.length, avgScore };
    });
    const attTotals = rows.reduce((acc, r) => ({ n: acc.n + (r.attendancePct ?? 0), c: acc.c + (r.attendancePct == null ? 0 : 1) }), { n: 0, c: 0 });
    const scoreTotals = rows.reduce((acc, r) => ({ n: acc.n + (r.avgScore ?? 0), c: acc.c + (r.avgScore == null ? 0 : 1) }), { n: 0, c: 0 });
    return ok({
      rows,
      overall: {
        students: rows.length,
        attendancePct: attTotals.c ? Math.round((attTotals.n / attTotals.c) * 10) / 10 : null,
        avgScore: scoreTotals.c ? Math.round((scoreTotals.n / scoreTotals.c) * 10) / 10 : null,
        testsTaken: results.length,
      },
    });
  } catch (err) {
    return serverError("faculty:analytics", err);
  }
}
