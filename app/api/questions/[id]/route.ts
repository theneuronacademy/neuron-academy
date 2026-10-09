// Phase 3 — Question detail API.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyMayManageTest } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

/**
 * Phase 17 — faculty scope for a question's parent test. ADMIN bypasses.
 * Returns null when allowed, otherwise the failure response to return.
 */
async function facultyScope(
  db: NonNullable<ReturnType<typeof getDb>>,
  userId: string,
  role: string,
  testId: string
): Promise<{ error: string; status: number } | null> {
  if (role === "ADMIN") return null;
  const allowed = await facultyMayManageTest(db, userId, testId);
  if (!allowed) return { error: "Question not found.", status: 404 };
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a question");
  try {
    const row = await db.question.findUnique({ where: { id } });
    if (!row) return fail("Question not found.", 404);
    // Phase 17 — faculty read only their own/assigned-batch test questions.
    const denied = await facultyScope(db, auth.user.id, auth.user.role, row.testId);
    if (denied) return fail(denied.error, denied.status);
    return ok({ item: row });
  } catch (err) {
    return serverError("questions:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a question");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    // Phase 17 — faculty edit only their own/assigned-batch test questions.
    const existing = await db.question.findUnique({ where: { id }, select: { testId: true } });
    if (!existing) return fail("Question not found.", 404);
    const denied = await facultyScope(db, auth.user.id, auth.user.role, existing.testId);
    if (denied) return fail(denied.error, denied.status);
    const row = await db.question.update({
      where: { id },
      data: {
        ...(typeof body.questionText === "string" ? { questionText: body.questionText } : {}),
        ...(typeof body.optionA === "string" ? { optionA: body.optionA } : {}),
        ...(typeof body.optionB === "string" ? { optionB: body.optionB } : {}),
        ...(typeof body.optionC === "string" ? { optionC: body.optionC } : {}),
        ...(typeof body.optionD === "string" ? { optionD: body.optionD } : {}),
        ...(typeof body.optionE === "string" ? { optionE: body.optionE } : {}),
        ...(typeof body.correctAnswer === "string" || body.correctAnswer === null ? { correctAnswer: body.correctAnswer } : {}),
        ...(typeof body.marks === "number" ? { marks: body.marks } : {}),
        ...(typeof body.negativeMarks === "number" ? { negativeMarks: body.negativeMarks } : {}),
        ...(typeof body.explanation === "string" ? { explanation: body.explanation } : {}),
        ...(typeof body.order === "number" ? { order: body.order } : {}),
        ...(typeof body.subject === "string" ? { subject: body.subject.slice(0, 60) } : {}),
        ...(body.reviewStatus === "PENDING" || body.reviewStatus === "APPROVED" || body.reviewStatus === "REJECTED"
          ? { reviewStatus: body.reviewStatus }
          : {}),
      },
    });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Question not found.", 404);
    return serverError("questions:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a question");
  try {
    const row = await db.question.findUnique({ where: { id } });
    if (!row) return fail("Question not found.", 404);
    // Phase 17 — faculty delete only their own/assigned-batch test questions.
    const denied = await facultyScope(db, auth.user.id, auth.user.role, row.testId);
    if (denied) return fail(denied.error, denied.status);
    await db.question.delete({ where: { id } });
    await db.test.update({ where: { id: row.testId }, data: { totalQuestions: { decrement: 1 } } }).catch(() => null);
    return ok({ deleted: true });
  } catch (err) {
    return serverError("questions:delete", err);
  }
}
