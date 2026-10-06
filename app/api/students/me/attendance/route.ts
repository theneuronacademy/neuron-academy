// Phase 14 — own attendance feed (REGULAR students only, read-only).
// ?month=YYYY-MM filters; summary always covers all time. Biometric/manual
// sources both served (existing Attendance model untouched).

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
  if (!db) return dbNotConfigured("Reading attendance");
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    const denied = requireRegular(scoped);
    if (denied || !scoped) return fail(denied?.error ?? "Student profile not found.", denied?.status ?? 403);

    const month = new URL(req.url).searchParams.get("month") ?? "";
    let range: { gte?: Date; lt?: Date } = {};
    const m = month.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      if (mo >= 1 && mo <= 12) {
        range = { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) };
      }
    }
    const where = { studentId: scoped.id, ...(range.gte ? { date: range } : {}) };
    const [rows, groups] = await Promise.all([
      db.attendance.findMany({
        where,
        select: { id: true, date: true, status: true, checkIn: true, checkOut: true, source: true, batchId: true },
        orderBy: { date: "desc" },
        take: 200,
      }),
      db.attendance.groupBy({ by: ["status"], where: { studentId: scoped.id }, _count: { status: true } }),
    ]);
    const s = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    for (const g of groups) s[g.status as keyof typeof s] = g._count.status;
    const total = s.PRESENT + s.ABSENT + s.LATE + s.LEAVE;
    return ok({
      items: rows,
      summary: {
        total,
        present: s.PRESENT,
        absent: s.ABSENT,
        late: s.LATE,
        leave: s.LEAVE,
        percentage: total > 0 ? Math.round(((s.PRESENT + s.LATE * 0.5) / total) * 1000) / 10 : null,
      },
    });
  } catch (err) {
    return serverError("students:attendance", err);
  }
}
