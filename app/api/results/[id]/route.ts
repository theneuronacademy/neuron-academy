// Phase 5 — Result detail API. STUDENT sees only own; FACULTY permitted
// tests; ADMIN all. Rank is returned only when stored (never invented).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { facultyBatchIds, resolveStudent } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shape(r: any) {
  return {
    id: r.id,
    testId: r.testId,
    testTitle: r.test?.title ?? "",
    studentId: r.studentId,
    studentName: r.student?.name ?? "",
    marks: r.marks,
    totalMarks: r.totalMarks,
    percentage: r.percentage,
    rank: r.rank ?? null,
    status: r.status,
    attempted: r.attempted ?? 0,
    correct: r.correct ?? 0,
    wrong: r.wrong ?? 0,
    unanswered: r.unanswered ?? 0,
    date: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "",
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a result");
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  try {
    const row = await db.result.findUnique({ where: { id }, include: { student: true, test: true } });
    if (!row) return fail("Result not found.", 404);
    if (viewer.role === "ADMIN") return ok({ item: shape(row) });
    if (viewer.role === "STUDENT") {
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      if (!profile || profile.id !== row.studentId) return fail("Result not found.", 404);
      return ok({ item: shape(row) });
    }
    if (viewer.role === "FACULTY") {
      const batchIds = await facultyBatchIds(db, viewer.id);
      const test = await db.test.findUnique({ where: { id: row.testId }, select: { createdById: true, batchId: true } });
      const allowed = test && (test.createdById === viewer.id || (test.batchId !== null && batchIds.includes(test.batchId)));
      if (!allowed) return fail("Result not found.", 404);
      return ok({ item: shape(row) });
    }
    return fail("Forbidden.", 403);
  } catch (err) {
    return serverError("results:get", err);
  }
}
