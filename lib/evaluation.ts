// Phase 5 — server-side auto evaluation (single source of truth).
// Rules: correct → +marks, wrong → −negativeMarks,
// unanswered → 0, unverified (null answer key) → pending review.
// Pure functions — no DB, no localStorage — safe to unit test.
// Client NEVER sends score/percentage; only answers are accepted.

export type AnswerLetter = "A" | "B" | "C" | "D";

export interface EvaluableQuestion {
  id: string;
  correctAnswer: string | null; // "A"-"D" letter, null = needs manual review
  marks: number;
  negativeMarks: number;
}

export interface EvaluationResult {
  attempted: number;
  correct: number;
  wrong: number;
  unanswered: number;
  pending: number;
  marks: number;
  totalMarks: number;
  percentage: number; // rounded to 1 decimal
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalize client answers: accept "A"-"D", index 0-3, null/undefined → null. */
export function normalizeAnswer(v: unknown): AnswerLetter | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 3) {
    return (["A", "B", "C", "D"] as const)[v];
  }
  if (typeof v === "string") {
    const t = v.trim().toUpperCase();
    if (t === "A" || t === "B" || t === "C" || t === "D") return t;
    if (t === "0" || t === "1" || t === "2" || t === "3") {
      return (["A", "B", "C", "D"] as const)[Number(t)];
    }
  }
  return null;
}

export function evaluateAnswers(
  questions: EvaluableQuestion[],
  rawAnswers: Record<string, unknown>
): EvaluationResult {
  let attempted = 0;
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  let pending = 0;
  let marks = 0;
  let totalMarks = 0;

  for (const q of questions) {
    totalMarks = round2(totalMarks + q.marks);
    if (q.correctAnswer === null) {
      pending += 1;
      continue;
    }
    const ans = normalizeAnswer(rawAnswers[q.id]);
    if (ans === null) {
      unanswered += 1;
      continue;
    }
    attempted += 1;
    if (ans === q.correctAnswer.toUpperCase()) {
      correct += 1;
      marks = round2(marks + q.marks);
    } else {
      wrong += 1;
      marks = round2(marks - (q.negativeMarks || 0));
    }
  }

  marks = Math.max(0, round2(marks));
  totalMarks = round2(totalMarks);
  return {
    attempted,
    correct,
    wrong,
    unanswered,
    pending,
    marks,
    totalMarks,
    percentage: totalMarks > 0 ? Math.round((marks / totalMarks) * 1000) / 10 : 0,
  };
}
