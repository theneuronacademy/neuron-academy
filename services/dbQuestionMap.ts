// Phase 6 — shared DB Question ↔ BankQuestion mappings.
// The premium QuestionCard/QuestionEditor stay BankQuestion-shaped; these
// mappers let API-backed pages reuse them without redesign.
// C4: mappings are faithful — subject, confidence, review state and the
// optional 5th option (E) round-trip instead of being silently dropped.

import type { BankQuestion } from "@/lib/testTypes";
import { nowISO, uid } from "@/lib/storage";

export const LETTERS = ["A", "B", "C", "D", "E"] as const;

export function letterToIndex(letter: unknown): number | null {
  if (typeof letter !== "string") return null;
  const i = LETTERS.indexOf(letter.toUpperCase() as (typeof LETTERS)[number]);
  return i >= 0 ? i : null;
}

function confidenceToScore(confidence: unknown): number {
  if (confidence === "HIGH") return 100;
  if (confidence === "MEDIUM") return 70;
  if (confidence === "LOW") return 40;
  return 100;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbQuestionToBank(r: any, testTitle: string): BankQuestion {
  // Options A–D always; E only when the database row actually has one, so
  // rows without a 5th option keep the classic 4-option shape.
  const opts = [r.optionA, r.optionB, r.optionC, r.optionD]
    .map((o) => (typeof o === "string" ? o : ""))
    .concat(typeof r.optionE === "string" && r.optionE ? [r.optionE] : []);
  const approved = r.reviewStatus === "APPROVED";
  return {
    id: String(r.id),
    question: String(r.questionText ?? ""),
    options: opts,
    correctAnswer: letterToIndex(r.correctAnswer),
    explanation: String(r.explanation ?? ""),
    subject: typeof r.subject === "string" && r.subject ? r.subject : "Database",
    chapter: testTitle,
    difficulty: "Medium",
    marks: typeof r.marks === "number" ? r.marks : 1,
    negativeMarks: typeof r.negativeMarks === "number" ? r.negativeMarks : 0,
    tags: [],
    sourceFile: typeof r.sourceFile === "string" && r.sourceFile ? r.sourceFile : "database",
    sourcePage: typeof r.sourcePage === "number" ? r.sourcePage : null,
    containsImage: false,
    imageUrl: "",
    confidence: confidenceToScore(r.confidence),
    needsReview: !approved,
    status: approved ? "approved" : "review",
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
  };
}

/** Blank editor template (relocated C6 from the deleted questionService — pure factory, no storage). */
export function blankQuestion(): BankQuestion {
  const t = nowISO();
  return {
    id: uid("q"),
    question: "",
    options: ["", "", "", ""],
    correctAnswer: null,
    explanation: "",
    subject: "Quantitative Aptitude",
    chapter: "Percentage",
    difficulty: "Medium",
    marks: 2,
    negativeMarks: 0.5,
    tags: [],
    sourceFile: "manual",
    sourcePage: null,
    containsImage: false,
    imageUrl: "",
    confidence: 100,
    needsReview: false,
    status: "draft",
    createdAt: t,
    updatedAt: t,
  };
}

/** BankQuestion editor patch → API body (letters for answers, E included). */
export function bankPatchToApi(patch: Partial<BankQuestion>): Record<string, unknown> {
  return {
    ...(patch.question !== undefined ? { questionText: patch.question } : {}),
    ...(patch.options?.[0] !== undefined ? { optionA: patch.options[0] } : {}),
    ...(patch.options?.[1] !== undefined ? { optionB: patch.options[1] } : {}),
    ...(patch.options?.[2] !== undefined ? { optionC: patch.options[2] } : {}),
    ...(patch.options?.[3] !== undefined ? { optionD: patch.options[3] } : {}),
    ...(patch.options?.[4] !== undefined ? { optionE: patch.options[4] } : {}),
    ...(patch.correctAnswer !== undefined ? { correctAnswer: patch.correctAnswer === null ? null : LETTERS[patch.correctAnswer] } : {}),
    ...(patch.explanation !== undefined ? { explanation: patch.explanation } : {}),
    ...(patch.marks !== undefined ? { marks: patch.marks } : {}),
    ...(patch.negativeMarks !== undefined ? { negativeMarks: patch.negativeMarks } : {}),
  };
}
