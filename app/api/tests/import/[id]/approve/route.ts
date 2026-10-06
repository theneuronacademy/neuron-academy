// Phase 12 — approve candidates into the pool (reviewStatus → APPROVED).
// Body: { ids?: string[] } (explicit selection) or { approveHigh?: true }.
// Only PENDING rows of this import's staging test are affected.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { importScope } from "@/lib/importScope";

export const dynamic = "force-dynamic";

async function refreshCounts(db: NonNullable<ReturnType<typeof getDb>>, importId: string, stagingTestId: string) {
  const [approved, rejected] = await Promise.all([
    db.question.count({ where: { testId: stagingTestId, reviewStatus: "APPROVED" } }),
    db.question.count({ where: { testId: stagingTestId, reviewStatus: "REJECTED" } }),
  ]);
  await db.pdfImport.update({ where: { id: importId }, data: { questionsApproved: approved, questionsRejected: rejected } });
  return { approved, rejected };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Approving questions");
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body allowed when ids present? no — require explicit selection */
  }
  try {
    const scope = await importScope(db, auth.user.role, auth.user.id, id);
    if (!scope.ok) return fail(scope.error ?? "Forbidden.", scope.status ?? 403);
    if (!scope.stagingTestId) return fail("Import has no staging test.", 422);
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
    const approveHigh = body.approveHigh === true;
    if (ids.length === 0 && !approveHigh) {
      return fail("Provide question ids or { approveHigh: true }.", 400);
    }
    const where = {
      testId: scope.stagingTestId,
      reviewStatus: "PENDING",
      ...(approveHigh ? { confidence: "HIGH" } : { id: { in: ids } }),
    };
    const result = await db.question.updateMany({ where, data: { reviewStatus: "APPROVED" } });
    const counts = await refreshCounts(db, id, scope.stagingTestId);
    return ok({ approvedNow: result.count, ...counts });
  } catch (err) {
    return serverError("tests:import-approve", err);
  }
}
