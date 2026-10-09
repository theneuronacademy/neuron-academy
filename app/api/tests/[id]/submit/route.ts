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
import { invertDisplayLetter, isValidQuestionMap, presentLetters } from "@/lib/testOrdering";
import { canStudentAccessTest, isLiveWindowOpen, resolveStudent } from "@/lib/testAccess";
import { notifyMessages } from "@/lib/notify";
import { dispatchNotification } from "@/services/notificationEngine";

export const dynamic = "force-dynamic";
// Vercel: access re-check + evaluation + attempt/result upserts under LIVE
// burst load + cold start (Pro plan).
export const maxDuration = 30;

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
    // Phase 13 — re-check access at submit time (a grant may have been
    // revoked or expired mid-attempt). Never trust the earlier check alone.
    const access = await canStudentAccessTest(db, profile.id, testId);
    if (!access.allowed) return fail(access.reason, access.http);
    // LIVE window re-validated at submit time (server clock).
    if (test.type === "LIVE") {
      const window = isLiveWindowOpen(test.type, test.status, test.startTime, test.endTime);
      if (!window.open) return fail(window.reason ?? "The submission window has closed.", 400);
    }
    if (test.type === "OFFLINE") return fail("Offline tests are not submitted online.", 400);

    // Phase 12: invert display letters through the attempt's stored option
    // mapping (RANDOM option order). The stored map is validated exactly
    // like paper assembly — an invalid map falls back to serial, so delivery
    // and evaluation can never disagree (no silent nulls).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMap = (attempt.optionMap ?? {}) as Record<string, any>;
    const originalAnswers: Record<string, unknown> = {};
    for (const q of test.questions) {
      const present = presentLetters([q.optionA, q.optionB, q.optionC, q.optionD, q.optionE]);
      const stored = isValidQuestionMap(rawMap[q.id], present) ? (rawMap[q.id] as string[]) : [...present];
      const disp = normalizeAnswer(answers[q.id]);
      if (disp === null) {
        originalAnswers[q.id] = null;
        continue;
      }
      originalAnswers[q.id] = invertDisplayLetter(disp, stored) ?? null;
    }

    const evalResult = evaluateAnswers(
      test.questions.map((q) => ({ id: q.id, correctAnswer: q.correctAnswer, marks: q.marks, negativeMarks: q.negativeMarks })),
      originalAnswers
    );
    // Persist ORIGINAL letters for reproducible review.
    const stored: Record<string, string | null> = {};
    for (const q of test.questions) stored[q.id] = normalizeAnswer(originalAnswers[q.id]);

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
    // Phase 13 — result notification via the centralized helper (never fails submission).
    // Phase 15 — notify only on first release; re-submits/re-evaluations stay
    // silent to avoid notification spam.
    // Phase 18b — via the centralized engine (RESULT_RELEASED, idempotent on
    // result id): student self-notify, SMS/push/in-app per policy, isolated.
    if (!existing) {
      const built = notifyMessages.resultReleased(test.title, evalResult.marks, evalResult.totalMarks, evalResult.percentage);
      await dispatchNotification(db, {
        event: "RESULT_RELEASED",
        actor: { id: auth.user.id, role: auth.user.role },
        audience: { kind: "INDIVIDUAL", studentId: profile.id },
        title: built.title,
        message: built.message,
        templateKey: "RESULT_RELEASED",
        vars: { testName: test.title, result: `${evalResult.marks}/${evalResult.totalMarks} (${evalResult.percentage}%)` },
        testId,
        internal: true,
        idempotencyKey: `RESULT_RELEASED:${result.id}`,
      });
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
