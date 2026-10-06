// Phase 14 — own batch experience (REGULAR students only, read-only).
// Current batch + course + faculty + upcoming tests + attendance summary.
// Scholarship students get 403 (no regular batch information).

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
  if (!db) return dbNotConfigured("Reading batches");
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    const denied = requireRegular(scoped);
    if (denied || !scoped) return fail(denied?.error ?? "Student profile not found.", denied?.status ?? 403);
    if (!scoped.batchId) return ok({ batch: null });

    const [batch, upcoming, attGroups] = await Promise.all([
      db.batch.findUnique({
        where: { id: scoped.batchId },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
          course: { select: { id: true, name: true } },
          faculty: { select: { id: true, name: true, subject: true, designation: true } },
        },
      }),
      db.test.findMany({
        where: { batchId: scoped.batchId, isActive: true, status: { in: ["SCHEDULED", "LIVE", "PUBLISHED"] } },
        select: { id: true, title: true, status: true, startTime: true, duration: true, accessType: true, price: true },
        orderBy: { startTime: "asc" },
        take: 20,
      }),
      db.attendance.groupBy({ by: ["status"], where: { studentId: scoped.id }, _count: { status: true } }),
    ]);
    if (!batch) return ok({ batch: null });
    const s: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    for (const g of attGroups) s[g.status] = g._count.status;
    const total = s.PRESENT + s.ABSENT + s.LATE + s.LEAVE;
    return ok({
      batch,
      upcoming,
      attendance: {
        total,
        present: s.PRESENT,
        absent: s.ABSENT,
        late: s.LATE,
        leave: s.LEAVE,
        percentage: total > 0 ? Math.round(((s.PRESENT + s.LATE * 0.5) / total) * 1000) / 10 : null,
      },
    });
  } catch (err) {
    return serverError("students:batches", err);
  }
}
