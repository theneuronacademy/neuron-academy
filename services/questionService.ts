// Business logic for questions — components call these, never localStorage.
import { deleteQuestion, getQuestionById, getQuestions, saveQuestions, updateQuestion, uid, nowISO } from "@/lib/storage";
import type { BankQuestion } from "@/lib/testTypes";
import type { ExtractedQuestion } from "@/services/questionExtraction";

export function toBankQuestion(e: ExtractedQuestion, fileName: string, page = 1): BankQuestion {
  return {
    id: e.id,
    question: e.question,
    options: [...e.options].slice(0, 4),
    correctAnswer: e.correctAnswer,
    explanation: e.explanation,
    subject: e.subject === "General" ? "Quantitative Aptitude" : e.subject,
    chapter: e.chapter,
    difficulty: e.difficulty,
    marks: 2,
    negativeMarks: 0.5,
    tags: [],
    sourceFile: fileName,
    sourcePage: page,
    containsImage: false,
    imageUrl: "",
    confidence: e.confidence,
    needsReview: e.needsReview,
    status: e.needsReview ? "review" : "draft",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

export function importExtracted(list: ExtractedQuestion[], fileName: string): BankQuestion[] {
  const bank = list.map((e, i) => toBankQuestion(e, fileName, Math.floor(i / 4) + 1));
  if (bank.length > 0) saveQuestions(bank);
  return bank;
}

export function approveQuestion(id: string): void {
  updateQuestion(id, { status: "approved", needsReview: false });
}

export function markReview(id: string): void {
  updateQuestion(id, { status: "review", needsReview: true });
}

export function bulkApprove(ids: string[]): void {
  ids.forEach((id) => updateQuestion(id, { status: "approved", needsReview: false }));
}

export function bulkDelete(ids: string[]): void {
  ids.forEach((id) => deleteQuestion(id));
}

export type QuestionFilter = "all" | "approved" | "review" | "missing-answer" | "high" | "low";

export function filterQuestions(qs: BankQuestion[], filter: QuestionFilter, search: string): BankQuestion[] {
  const s = search.trim().toLowerCase();
  return qs.filter((q) => {
    if (s && !`${q.question} ${q.chapter} ${q.subject} ${q.sourceFile}`.toLowerCase().includes(s)) return false;
    switch (filter) {
      case "approved":
        return q.status === "approved";
      case "review":
        return q.status === "review" || q.needsReview;
      case "missing-answer":
        return q.correctAnswer === null;
      case "high":
        return q.confidence >= 75;
      case "low":
        return q.confidence < 75;
      default:
        return true;
    }
  });
}

export function availableForTest(qs: BankQuestion[]): BankQuestion[] {
  return qs.filter((q) => q.status === "approved" && q.correctAnswer !== null && q.options.every((o) => o.trim().length > 0));
}

/** Select N questions without duplicates. Modes: sequential | random | manual(ids). */
export function selectQuestions(
  pool: BankQuestion[],
  count: number,
  mode: "sequential" | "random" | "manual" = "random",
  manualIds: string[] = []
): BankQuestion[] {
  if (mode === "manual") {
    const set = new Map(pool.map((q) => [q.id, q]));
    return manualIds.map((id) => set.get(id)).filter((q): q is BankQuestion => !!q).slice(0, count);
  }
  const eligible = availableForTest(pool);
  if (mode === "sequential") return eligible.slice(0, count);
  const arr = [...eligible];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

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

export { getQuestionById, getQuestions };
