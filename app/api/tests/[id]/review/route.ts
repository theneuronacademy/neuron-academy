// Phase 6 — post-submission question-wise review (STUDENT, own attempt only).
// Returns questions WITH correct answers + the student's answers + awarded
// marks — safe because it requires an EVALUATED/SUBMITTED attempt belonging
// to the caller. Before submission, answers stay hidden (see
// GET /api/questions, which strips them).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { normalizeAnswer } from "@/lib/evaluation";
import { canStudentAccessTest, resolveStudent } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: testId } = await params;
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading review");
  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile) return fail("Student profile not found.", 403);
    const attempt = await db.testAttempt.findFirst({
      where: { testId, studentId: profile.id, status: { in: ["SUBMITTED", "EVALUATED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!attempt) return fail("No submitted attempt found for this test.", 404);
    const test = await db.test.findUnique({ where: { id: testId }, include: { questions: { orderBy: { order: "asc" } } } });
    if (!test) return fail("Test not found.", 404);
    // Phase 13 — revoked/expired grants lose review access too.
    const access = await canStudentAccessTest(db, profile.id, testId);
    if (!access.allowed) return fail(access.reason, access.http);
    const stored = (attempt.answers ?? {}) as Record<string, string | null>;
    const items = test.questions.map((q, i) => {
      const your = normalizeAnswer(stored[q.id]);
      const awarded = q.correctAnswer === null || your === null ? 0 : your === q.correctAnswer.toUpperCase() ? q.marks : -(q.negativeMarks || 0);
      return {
        order: i + 1,
        questionId: q.id,
        questionText: q.questionText,
        options: [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE],
        yourAnswer: your,
        correctAnswer: q.correctAnswer,
        marksAwarded: Math.max(0, Math.round(awarded * 100) / 100),
        maxMarks: q.marks,
        status: q.correctAnswer === null ? "pending" : your === null ? "unattempted" : your === q.correctAnswer.toUpperCase() ? "correct" : "incorrect",
      };
    });
    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("tests:review", err);
  }
}
