// Phase 14 — own academic analytics (REGULAR students only).
// Aggregates only: no N+1, no invented numbers. Empty data → honest empty
// states (the UI renders "No test data yet" / "No attendance data yet").

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { getScopedStudent, requireRegular } from "@/lib/studentScope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT") return fail("Forbidden.", 403);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading analytics");
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    const denied = requireRegular(scoped);
    if (denied || !scoped) return fail(denied?.error ?? "Student profile not found.", denied?.status ?? 403);

    // One query per aggregate family — no per-row fetching.
    const [results, attempts, attGroups, recent] = await Promise.all([
      db.result.findMany({
        where: { studentId: scoped.id },
        select: { marks: true, totalMarks: true, percentage: true, createdAt: true, test: { select: { title: true } } },
        orderBy: { createdAt: "asc" },
        take: 500,
      }),
      db.testAttempt.groupBy({
        by: ["status"],
        where: { studentId: scoped.id },
        _count: { status: true },
      }),
      db.attendance.groupBy({
        by: ["status"],
        where: { studentId: scoped.id },
        _count: { status: true },
      }),
      db.result.findMany({
        where: { studentId: scoped.id },
        select: { marks: true, totalMarks: true, percentage: true, createdAt: true, test: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

    const pcts = results.map((r) => Number(r.percentage ?? 0));
    const testsAttempted = results.length;
    const avg = testsAttempted > 0 ? Math.round((pcts.reduce((a, b) => a + b, 0) / testsAttempted) * 10) / 10 : null;
    const inProgress = attempts.find((a) => a.status === "IN_PROGRESS")?._count.status ?? 0;
    const completed = attempts
      .filter((a) => a.status === "SUBMITTED" || a.status === "EVALUATED")
      .reduce((n, a) => n + a._count.status, 0);

    const att = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    for (const g of attGroups) att[g.status as keyof typeof att] = g._count.status;
    const attTotal = att.PRESENT + att.ABSENT + att.LATE + att.LEAVE;
    const attPct = attTotal > 0 ? Math.round(((att.PRESENT + att.LATE * 0.5) / attTotal) * 1000) / 10 : null;

    return ok({
      tests: {
        attempted: testsAttempted,
        completed,
        inProgress,
        averagePercentage: avg,
        highest: testsAttempted > 0 ? Math.max(...pcts) : null,
        lowest: testsAttempted > 0 ? Math.min(...pcts) : null,
        trend: recent.reverse().map((r) => ({
          title: r.test?.title ?? "Test",
          percentage: Number(r.percentage ?? 0),
          date: r.createdAt,
        })),
      },
      attendance: {
        total: attTotal,
        present: att.PRESENT,
        absent: att.ABSENT,
        late: att.LATE,
        leave: att.LEAVE,
        percentage: attPct,
      },
    });
  } catch (err) {
    return serverError("students:analytics", err);
  }
}
