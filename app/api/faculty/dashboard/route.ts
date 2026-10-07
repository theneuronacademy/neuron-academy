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
  if (!db) return dbNotConfigured("Reading faculty dashboard");
  try {
    const batchIds = auth.user.role === "ADMIN"
      ? (await db.batch.findMany({ select: { id: true }, take: 500 })).map((b) => b.id)
      : await facultyBatchIds(db, auth.user.id);
    const [batchCount, studentCount, upcomingTests, pendingEval, attRows] = await Promise.all([
      db.batch.count({ where: batchIds.length ? { id: { in: batchIds } } : { id: "__none__" } }),
      db.student.count({ where: batchIds.length ? { batchId: { in: batchIds } } : { id: "__none__" } }),
      db.test.count({
        where: {
          status: { in: ["SCHEDULED", "LIVE", "PUBLISHED"] },
          isActive: true,
          OR: [{ createdById: auth.user.id }, ...(batchIds.length ? [{ batchId: { in: batchIds } }] : [])],
        },
      }),
      db.testAttempt.count({
        where: {
          status: "SUBMITTED",
          test: { OR: [{ createdById: auth.user.id }, ...(batchIds.length ? [{ batchId: { in: batchIds } }] : [])] },
        },
      }).catch(() => 0),
      db.attendance.findMany({
        where: batchIds.length ? { batchId: { in: batchIds } } : { id: "__none__" },
        orderBy: { date: "desc" },
        take: 200,
        select: { status: true },
      }).catch(() => []),
    ]);
    const total = attRows.length;
    const present = attRows.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 1000) / 10 : null;
    return ok({
      totalBatches: batchCount,
      totalStudents: studentCount,
      upcomingTests,
      pendingEvaluations: pendingEval,
      attendanceRate,
    });
  } catch (err) {
    return serverError("faculty:dashboard", err);
  }
}
