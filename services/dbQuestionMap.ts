// Phase 6 — shared DB Question ↔ BankQuestion mappings.
// The premium QuestionCard/QuestionEditor stay BankQuestion-shaped; these
// mappers let API-backed pages reuse them without redesign.

import type { BankQuestion } from "@/lib/testTypes";

export const LETTERS = ["A", "B", "C", "D"] as const;

export function letterToIndex(letter: unknown): number | null {
  if (typeof letter !== "string") return null;
  const i = LETTERS.indexOf(letter.toUpperCase() as (typeof LETTERS)[number]);
  return i >= 0 ? i : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbQuestionToBank(r: any, testTitle: string): BankQuestion {
  const opts = [r.optionA, r.optionB, r.optionC, r.optionD].map((o) => (typeof o === "string" ? o : ""));
  return {
    id: String(r.id),
    question: String(r.questionText ?? ""),
    options: opts,
    correctAnswer: letterToIndex(r.correctAnswer),
    explanation: String(r.explanation ?? ""),
    subject: "Database",
    chapter: testTitle,
    difficulty: "Medium",
    marks: typeof r.marks === "number" ? r.marks : 1,
    negativeMarks: typeof r.negativeMarks === "number" ? r.negativeMarks : 0,
    tags: [],
    sourceFile: "database",
    sourcePage: null,
    containsImage: false,
    imageUrl: "",
    confidence: 100,
    needsReview: false,
    status: "approved",
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
  };
}

/** BankQuestion editor patch → API body (letters for answers). */
export function bankPatchToApi(patch: Partial<BankQuestion>): Record<string, unknown> {
  return {
    ...(patch.question !== undefined ? { questionText: patch.question } : {}),
    ...(patch.options?.[0] !== undefined ? { optionA: patch.options[0] } : {}),
    ...(patch.options?.[1] !== undefined ? { optionB: patch.options[1] } : {}),
    ...(patch.options?.[2] !== undefined ? { optionC: patch.options[2] } : {}),
    ...(patch.options?.[3] !== undefined ? { optionD: patch.options[3] } : {}),
    ...(patch.correctAnswer !== undefined ? { correctAnswer: patch.correctAnswer === null ? null : LETTERS[patch.correctAnswer] } : {}),
    ...(patch.explanation !== undefined ? { explanation: patch.explanation } : {}),
    ...(patch.marks !== undefined ? { marks: patch.marks } : {}),
    ...(patch.negativeMarks !== undefined ? { negativeMarks: patch.negativeMarks } : {}),
  };
}
