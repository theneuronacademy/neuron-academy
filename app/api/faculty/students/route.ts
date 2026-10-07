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
  if (!db) return dbNotConfigured("Reading faculty students");
  try {
    const params = new URL(req.url).searchParams;
    const search = (params.get("search") ?? "").trim();
    const batchId = params.get("batchId") ?? "";
    const batchIds = auth.user.role === "ADMIN"
      ? (await db.batch.findMany({ select: { id: true }, take: 500 })).map((b) => b.id)
      : await facultyBatchIds(db, auth.user.id);
    if (batchIds.length === 0) return ok({ items: [], source: "database" });
    if (batchId && !batchIds.includes(batchId)) return fail("Forbidden: batch not assigned to you.", 403);
    const digits = search.replace(/\D/g, "");
    const rows = await db.student.findMany({
      where: {
        batchId: batchId ? batchId : { in: batchIds },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                ...(digits ? [{ phone: { contains: digits } }] : []),
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 300,
      select: {
        id: true,
        studentId: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        batchId: true,
        batch: { select: { id: true, name: true } },
      },
    });
    const studentIds = rows.map((r) => r.id);
    const [att, results] = await Promise.all([
      studentIds.length
        ? db.attendance.groupBy({ by: ["studentId", "status"], where: { studentId: { in: studentIds } }, _count: { status: true } })
        : [],
      studentIds.length
        ? db.result.findMany({ where: { studentId: { in: studentIds } }, select: { studentId: true, percentage: true } })
        : [],
    ]);
    const attByStudent = new Map<string, { total: number; present: number }>();
    for (const a of att) {
      const cur = attByStudent.get(a.studentId) ?? { total: 0, present: 0 };
      cur.total += a._count.status;
      if (a.status === "PRESENT" || a.status === "LATE") cur.present += a._count.status;
      attByStudent.set(a.studentId, cur);
    }
    const resByStudent = new Map<string, { count: number; sum: number }>();
    for (const r of results) {
      const cur = resByStudent.get(r.studentId) ?? { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += r.percentage ?? 0;
      resByStudent.set(r.studentId, cur);
    }
    const items = rows.map((r) => {
      const a = attByStudent.get(r.id);
      const g = resByStudent.get(r.id);
      return {
        id: r.id,
        studentId: r.studentId,
        name: r.name,
        email: r.email,
        phone: r.phone,
        status: String(r.status ?? "ACTIVE").toLowerCase(),
        batchId: r.batchId,
        batch: r.batch?.name ?? "—",
        attendancePct: a && a.total > 0 ? Math.round((a.present / a.total) * 1000) / 10 : null,
        testsTaken: g?.count ?? 0,
        avgScore: g && g.count > 0 ? Math.round((g.sum / g.count) * 10) / 10 : null,
      };
    });
    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("faculty:students", err);
  }
}
