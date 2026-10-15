// Per-question item analysis for a test (FACULTY own/assigned tests, ADMIN all).
// GET /api/faculty/tests/[id]/analysis
// Reads SUBMITTED/EVALUATED attempts (server-persisted answers) against the
// DB answer keys — the same evidence the review endpoint uses. Only
// key-bearing questions (correctAnswer set) are analyzable; subjective
// questions report as unevaluable instead of fake numbers.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { normalizeAnswer } from "@/lib/evaluation";
import { facultyMayManageTest } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading item analysis");
  const { id: testId } = await params;
  try {
    if (auth.user.role === "FACULTY" && !(await facultyMayManageTest(db, auth.user.id, testId))) {
      return fail("Test not found.", 404);
    }
    const test = await db.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        title: true,
        questions: {
          orderBy: { order: "asc" },
          select: { id: true, questionText: true, correctAnswer: true, marks: true, subject: true },
        },
      },
    });
    if (!test) return fail("Test not found.", 404);

    const attempts = await db.testAttempt.findMany({
      where: { testId, status: { in: ["SUBMITTED", "EVALUATED"] } },
      select: { answers: true },
      take: 500,
    });

    const items = test.questions.map((q, i) => {
      if (!q.correctAnswer) {
        return {
          order: i + 1,
          questionId: q.id,
          questionText: q.questionText.slice(0, 120),
          subject: q.subject,
          evaluable: false,
          correct: 0,
          wrong: 0,
          unattempted: 0,
          total: attempts.length,
          correctPct: null as number | null,
        };
      }
      const key = q.correctAnswer.toUpperCase();
      let correct = 0;
      let wrong = 0;
      let unattempted = 0;
      for (const a of attempts) {
        const stored = ((a.answers ?? {}) as Record<string, string | null>)[q.id];
        const your = normalizeAnswer(stored);
        if (your === null) unattempted += 1;
        else if (your === key) correct += 1;
        else wrong += 1;
      }
      const total = attempts.length;
      return {
        order: i + 1,
        questionId: q.id,
        questionText: q.questionText.slice(0, 120),
        subject: q.subject,
        evaluable: true,
        correct,
        wrong,
        unattempted,
        total,
        correctPct: total > 0 ? Math.round((correct / total) * 1000) / 10 : null,
      };
    });

    const evaluable = items.filter((x) => x.evaluable && x.total > 0);
    const hardest = evaluable.length
      ? evaluable.reduce((a, b) => ((b.correctPct ?? 101) < (a.correctPct ?? 101) ? b : a))
      : null;

    return ok({ test: { id: test.id, title: test.title }, attempts: attempts.length, items, hardest, source: "database" });
  } catch (err) {
    return serverError("faculty:analysis", err);
  }
}
