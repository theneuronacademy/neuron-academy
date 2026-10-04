// Phase 6 — dashboard test statistics (ADMIN only).
// Aggregates server-side so the admin dashboard never downloads large
// datasets to compute counts in the browser.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading dashboard stats");
  try {
    const [byStatus, totalResults, totalAttempts] = await Promise.all([
      db.test.groupBy({ by: ["status"], _count: { status: true } }),
      db.result.count(),
      db.testAttempt.count(),
    ]);
    const get = (s: string) => byStatus.find((r) => r.status === s)?._count.status ?? 0;
    return ok({
      totalTests: byStatus.reduce((n, r) => n + r._count.status, 0),
      draftTests: get("DRAFT"),
      scheduledTests: get("SCHEDULED"),
      liveTests: get("LIVE"),
      publishedTests: get("PUBLISHED"),
      completedTests: get("COMPLETED"),
      totalResults,
      totalAttempts,
      source: "database",
    });
  } catch (err) {
    return serverError("dashboard:stats", err);
  }
}
