// Phase 12 — question import boundary (implemented).
// Live pipeline:
//   ADMIN → Upload PDF → POST /api/tests/import/pdf → services/pdfImport.ts
//   (pdfjs text) → services/ocrService.ts (tesseract for scanned pages) →
//   services/questionParser.ts (deterministic detection) → PdfImport +
//   staging test → review UI → approve → pool → POST /api/tests/generate.
// This file keeps the shared validation helper + the legacy client stub.
//

export type ImportAnswerLetter = "A" | "B" | "C" | "D";
// OLD LOCAL MODEL → PRISMA MODEL mapping (for the migration):
//   BankQuestion.question    → Question.questionText
//   BankQuestion.options[0..3] → Question.optionA..D
//   BankQuestion.correctAnswer (0-3 index | null) → Question.correctAnswer ("A"-"D" | null)
//   BankQuestion.marks / negativeMarks → same
//   BankQuestion.explanation → Question.explanation
//   TestItem.questionIds[]  → Question rows with testId + order
//   TestItem.name/durationMinutes/marksPerQuestion → Test.title/duration/totalMarks
//   TestItem.status draft/scheduled/published/live/completed → TestStatus enum (uppercased)
//   TestAttempt (localStorage) → TestAttempt (+ answers JSON)
//   TestResult (localStorage) → Result (+ attempted/correct/wrong/unanswered)

export interface ImportableQuestion {
  questionText: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: ImportAnswerLetter | null;
  marks?: number;
  negativeMarks?: number;
  explanation?: string;
  order?: number;
  questionType?: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "NUMERIC";
}

export interface ImportValidation {
  valid: ImportableQuestion[];
  errors: { index: number; reason: string }[];
}

/** Validate raw rows before they touch the database. Pure function. */
export function validateImport(rows: ImportableQuestion[]): ImportValidation {
  const valid: ImportableQuestion[] = [];
  const errors: { index: number; reason: string }[] = [];
  rows.forEach((r, index) => {
    if (!r.questionText || !r.questionText.trim()) {
      errors.push({ index, reason: "Missing question text." });
      return;
    }
    if (r.correctAnswer && !["A", "B", "C", "D"].includes(r.correctAnswer)) {
      errors.push({ index, reason: "correctAnswer must be A, B, C or D." });
      return;
    }
    valid.push({
      ...r,
      questionText: r.questionText.trim(),
      marks: typeof r.marks === "number" && r.marks > 0 ? r.marks : 1,
      negativeMarks: typeof r.negativeMarks === "number" && r.negativeMarks >= 0 ? r.negativeMarks : 0,
      order: typeof r.order === "number" ? r.order : index,
      questionType: r.questionType ?? "MCQ",
    });
  });
  return { valid, errors };
}

/**
 * Legacy browser-side stub — superseded by the server pipeline above.
 * Kept (throwing) so old callers fail loudly instead of silently.
 */
export async function parsePdfFromFile(_file: File): Promise<ImportableQuestion[]> {
  void _file;
  throw new Error("Use POST /api/tests/import/pdf — client-side parsing was removed in Phase 12.");
}
