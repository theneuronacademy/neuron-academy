// Shared Test Platform models. Storage lives in lib/storage.ts (localStorage
// mock). Swap service functions with API calls later — component contracts
// stay the same.

export type Difficulty = "Easy" | "Medium" | "Hard";
export type QuestionStatus = "draft" | "review" | "approved" | "archived";
export type TestStatus = "draft" | "scheduled" | "published" | "live" | "completed" | "archived";

export interface BankQuestion {
  id: string;
  question: string;
  options: string[]; // exactly 4: A,B,C,D
  correctAnswer: number | null; // 0-3, null = needs admin review (never invented)
  explanation: string;
  subject: string;
  chapter: string;
  difficulty: Difficulty;
  marks: number;
  negativeMarks: number;
  tags: string[];
  sourceFile: string;
  sourcePage: number | null;
  containsImage: boolean;
  imageUrl: string;
  confidence: number; // 0-100
  needsReview: boolean;
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TestItem {
  id: string;
  name: string;
  description: string;
  subject: string;
  chapter: string;
  questionIds: string[];
  durationMinutes: number;
  marksPerQuestion: number;
  negativeMarks: number;
  difficulty: string; // "Mixed" | Easy | Medium | Hard
  status: TestStatus;
  startAt: string; // ISO or ""
  endAt: string; // ISO or ""
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  source: "pdf" | "manual" | "demo";
  // Phase 7 cutover bridge: PostgreSQL id when this test was mirrored via
  // /api/tests (dual-write). Absent in pure-demo mode. Never set by hand.
  remoteId?: string;
}

export interface TestAttempt {
  id: string;
  testId: string;
  studentId: string;
  studentName: string;
  answers: Record<string, number | null>;
  marked: string[];
  timeTakenSec: number;
  submittedAt: string;
}

export interface ResultDetail {
  questionId: string;
  question: string;
  options: string[];
  yourAnswer: number | null;
  correctAnswer: number | null;
  status: "correct" | "incorrect" | "unattempted" | "pending";
}

export interface TestResult {
  id: string;
  testId: string;
  testName: string;
  studentId: string;
  studentName: string;
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  pending: number;
  marks: number;
  maxMarks: number;
  percentage: number;
  accuracy: number;
  timeTakenSec: number;
  details: ResultDetail[];
  createdAt: string;
  manual: boolean;
}

export interface TestNotification {
  id: string;
  title: string;
  message: string;
  type: "test" | "announcement" | "result";
  target: "students" | "all";
  testId: string;
  createdAt: string;
  read: boolean;
}

export interface OfflineMarkRow {
  studentId: string;
  studentName: string;
  marks: string;
}
