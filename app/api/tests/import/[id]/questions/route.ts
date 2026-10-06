// Phase 12 — import candidate questions (review queue).
// Full rows WITH keys (staff only — never exposed to students).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { importScope } from "@/lib/importScope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading import questions");
  try {
    const scope = await importScope(db, auth.user.role, auth.user.id, id);
    if (!scope.ok) return fail(scope.error ?? "Forbidden.", scope.status ?? 403);
    if (!scope.stagingTestId) return ok({ items: [], source: "database" });
    const url = new URL(req.url);
    const reviewStatus = url.searchParams.get("reviewStatus");
    const confidence = url.searchParams.get("confidence");
    const rows = await db.question.findMany({
      where: {
        testId: scope.stagingTestId,
        ...(reviewStatus === "PENDING" || reviewStatus === "APPROVED" || reviewStatus === "REJECTED"
          ? { reviewStatus }
          : {}),
        ...(confidence === "HIGH" || confidence === "MEDIUM" || confidence === "LOW" ? { confidence } : {}),
      },
      orderBy: { order: "asc" },
      take: 1000,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("tests:import-questions", err);
  }
}
