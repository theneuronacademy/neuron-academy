// Attendance overview for the admin dashboard (ADMIN / FACULTY).
// Aggregates Attendance rows per batch: { overview: [{ batch, pct }], avg }.
// Demo fallback when DATABASE_URL is missing.

import { NextRequest } from "next/server";
import { ok, fail, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";
import { DEMO_ATTENDANCE_OVERVIEW } from "@/data/admin";

export const dynamic = "force-dynamic";

function avgOf(pcts: number[]): number {
  if (pcts.length === 0) return 0;
  return Math.round(pcts.reduce((n, v) => n + v, 0) / pcts.length);
}

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) {
    return ok({ overview: DEMO_ATTENDANCE_OVERVIEW, avg: avgOf(DEMO_ATTENDANCE_OVERVIEW.map((r) => r.pct)), source: "demo" });
  }
  try {
    let allowed: string[] | null = null;
    if (auth.user.role === "FACULTY") {
      allowed = await facultyBatchIds(db, auth.user.id);
      if (allowed.length === 0) return ok({ overview: [], avg: 0, source: "database" });
    }
    const batches = await db.batch.findMany({
      where: allowed ? { id: { in: allowed } } : {},
      select: { id: true, name: true },
      take: 100,
    });
    const nameById = new Map(batches.map((b) => [b.id, b.name]));
    const rows = await db.attendance.findMany({
      where: allowed ? { batchId: { in: allowed } } : {},
      select: { batchId: true, status: true },
      take: 5000,
    });
    const byBatch = new Map<string, { total: number; present: number }>();
    for (const r of rows) {
      const cur = byBatch.get(r.batchId) ?? { total: 0, present: 0 };
      cur.total += 1;
      if (r.status === "PRESENT" || r.status === "LATE") cur.present += 1;
      byBatch.set(r.batchId, cur);
    }
    const overview = batches
      .map((b) => {
        const cur = byBatch.get(b.id);
        if (!cur || cur.total === 0) return null;
        return { batch: b.name, pct: Math.round((cur.present / cur.total) * 100) };
      })
      .filter((r): r is { batch: string; pct: number } => r !== null)
      .slice(0, 12);
    return ok({ overview, avg: avgOf(overview.map((r) => r.pct)), source: "database" });
  } catch (err) {
    return serverError("attendance:overview", err);
  }
}
