// Phase 5 — question import boundary (PDF/OCR lands here later).
// Future flow (NOT implemented now):
//   ADMIN → Upload PDF → PDF parser / OCR → ExtractedQuestion[] →
//   admin previews → admin verifies → save via /api/questions → test ready.
// This file is the ONLY place the future extractor plugs in. Nothing here
// fakes extraction: parsePdfFromFile() throws until Phase-PDF implements it.
//
// OLD LOCAL MODEL → PRISMA MODEL mapping (for the migration):
//   BankQuestion.id          → Question.id (cuid kept where possible)
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

export type ImportAnswerLetter = "A" | "B" | "C" | "D";

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
 * TODO Phase-PDF: implement with pdfjs-dist text layer + OCR fallback.
 * Must return ImportableQuestion[] for admin preview — never auto-save.
 */
export async function parsePdfFromFile(_file: File): Promise<ImportableQuestion[]> {
  void _file;
  throw new Error("PDF question extraction is not implemented yet (planned phase).");
}
