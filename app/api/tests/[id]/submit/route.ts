// Phase 5 — Submit attempt: server evaluates, never trusts client marks.
// Flow: validate attempt (own, IN_PROGRESS, window still open for LIVE) →
// load real questions → evaluate → persist answers + score on attempt →
// upsert Result (breakdown) → INDIVIDUAL notification → return summary.
// Post-submission review (with correct answers) is returned — the student
// already submitted, so nothing leaks early. No modification afterwards.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { evaluateAnswers, normalizeAnswer } from "@/lib/evaluation";
import { isLiveWindowOpen, resolveStudent } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: testId } = await params;
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Submitting a test attempt");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const answers = (body.answers ?? {}) as Record<string, unknown>;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return fail("Answers must be an object.", 400);
  }
  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile) return fail("Student profile not found.", 403);
    const attemptId = typeof body.attemptId === "string" ? body.attemptId : null;
    const attempt = attemptId
      ? await db.testAttempt.findUnique({ where: { id: attemptId } })
      : await db.testAttempt.findFirst({ where: { testId, studentId: profile.id, status: "IN_PROGRESS" }, orderBy: { createdAt: "desc" } });
    if (!attempt || attempt.testId !== testId || attempt.studentId !== profile.id) {
      return fail("Attempt not found. Start the test first.", 404);
    }
    if (attempt.status !== "IN_PROGRESS") {
      return fail("This attempt is already submitted and cannot be modified.", 409);
    }
    const test = await db.test.findUnique({ where: { id: testId }, include: { questions: { orderBy: { order: "asc" } } } });
    if (!test) return fail("Test not found.", 404);
    // LIVE window re-validated at submit time (server clock).
    if (test.type === "LIVE") {
      const window = isLiveWindowOpen(test.type, test.status, test.startTime, test.endTime);
      if (!window.open) return fail(window.reason ?? "The submission window has closed.", 400);
    }
    if (test.type === "OFFLINE") return fail("Offline tests are not submitted online.", 400);

    const evalResult = evaluateAnswers(
      test.questions.map((q) => ({ id: q.id, correctAnswer: q.correctAnswer, marks: q.marks, negativeMarks: q.negativeMarks })),
      answers
    );
    // Persist normalized answers (letters) for reproducible review.
    const stored: Record<string, string | null> = {};
    for (const q of test.questions) stored[q.id] = normalizeAnswer(answers[q.id]);

    const updated = await db.testAttempt.update({
      where: { id: attempt.id },
      data: {
        answers: stored,
        score: evalResult.marks,
        totalMarks: evalResult.totalMarks,
        percentage: evalResult.percentage,
        status: "EVALUATED",
        submittedAt: new Date(),
      },
    });
    const existing = await db.result.findFirst({ where: { studentId: profile.id, testId } });
    const result = existing
      ? await db.result.update({
          where: { id: existing.id },
          data: {
            marks: evalResult.marks,
            totalMarks: evalResult.totalMarks,
            percentage: evalResult.percentage,
            attempted: evalResult.attempted,
            correct: evalResult.correct,
            wrong: evalResult.wrong,
            unanswered: evalResult.unanswered,
            status: "PUBLISHED",
          },
        })
      : await db.result.create({
          data: {
            studentId: profile.id,
            testId,
            marks: evalResult.marks,
            totalMarks: evalResult.totalMarks,
            percentage: evalResult.percentage,
            attempted: evalResult.attempted,
            correct: evalResult.correct,
            wrong: evalResult.wrong,
            unanswered: evalResult.unanswered,
            status: "PUBLISHED",
          },
        });
    try {
      await db.notification.create({
        data: {
          title: "Your result has been released",
          message: `${test.title}: ${evalResult.marks}/${evalResult.totalMarks} (${evalResult.percentage}%).`,
          type: "result",
          audience: "INDIVIDUAL",
          targetStudentId: profile.id,
          sentAt: new Date(),
          status: "SENT",
        },
      });
    } catch {
      /* notification must never fail submission */
    }
    return ok({
      attempt: { id: updated.id, status: updated.status },
      result: {
        id: result.id,
        marks: evalResult.marks,
        totalMarks: evalResult.totalMarks,
        percentage: evalResult.percentage,
        attempted: evalResult.attempted,
        correct: evalResult.correct,
        wrong: evalResult.wrong,
        unanswered: evalResult.unanswered,
        pending: evalResult.pending,
      },
    });
  } catch (err) {
    return serverError("tests:submit", err);
  }
}
