// Phase 12 — reject candidates (reviewStatus → REJECTED).
// Body: { ids?: string[] } or { rejectLow?: true } (LOW confidence only).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { importScope } from "@/lib/importScope";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Rejecting questions");
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* require explicit selection below */
  }
  try {
    const scope = await importScope(db, auth.user.role, auth.user.id, id);
    if (!scope.ok) return fail(scope.error ?? "Forbidden.", scope.status ?? 403);
    if (!scope.stagingTestId) return fail("Import has no staging test.", 422);
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
    const rejectLow = body.rejectLow === true;
    if (ids.length === 0 && !rejectLow) {
      return fail("Provide question ids or { rejectLow: true }.", 400);
    }
    const where = {
      testId: scope.stagingTestId,
      reviewStatus: "PENDING",
      ...(rejectLow ? { confidence: "LOW" } : { id: { in: ids } }),
    };
    const result = await db.question.updateMany({ where, data: { reviewStatus: "REJECTED" } });
    const [approved, rejected] = await Promise.all([
      db.question.count({ where: { testId: scope.stagingTestId, reviewStatus: "APPROVED" } }),
      db.question.count({ where: { testId: scope.stagingTestId, reviewStatus: "REJECTED" } }),
    ]);
    await db.pdfImport.update({ where: { id }, data: { questionsApproved: approved, questionsRejected: rejected } });
    return ok({ rejected: result.count, approved, rejectedTotal: rejected });
  } catch (err) {
    return serverError("tests:import-reject", err);
  }
}
