// Evaluation logic — compares studentAnswer vs correctAnswer. Questions
// without a verified answer are marked pending (manual/admin review) and
// excluded from auto scoring. Never invents answers.
import { saveAttempt, saveResult, uid, nowISO } from "@/lib/storage";
import type { BankQuestion, TestAttempt, TestItem, TestResult } from "@/lib/testTypes";

export function evaluateTest(
  test: TestItem,
  questions: BankQuestion[],
  answers: Record<string, number | null>,
  timeTakenSec: number,
  student: { studentId: string; studentName: string }
): TestResult {
  let attempted = 0;
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  let pending = 0;
  let marks = 0;
  const maxMarks = questions.length * test.marksPerQuestion;

  const details = questions.map((q) => {
    const yourAnswer = answers[q.id] ?? null;
    if (q.correctAnswer === null) {
      pending += 1;
      return {
        questionId: q.id,
        question: q.question,
        options: q.options,
        yourAnswer,
        correctAnswer: null,
        status: "pending" as const,
      };
    }
    if (yourAnswer === null || yourAnswer === undefined) {
      unattempted += 1;
      return {
        questionId: q.id,
        question: q.question,
        options: q.options,
        yourAnswer: null,
        correctAnswer: q.correctAnswer,
        status: "unattempted" as const,
      };
    }
    attempted += 1;
    if (yourAnswer === q.correctAnswer) {
      correct += 1;
      marks += test.marksPerQuestion;
      return {
        questionId: q.id,
        question: q.question,
        options: q.options,
        yourAnswer,
        correctAnswer: q.correctAnswer,
        status: "correct" as const,
      };
    }
    incorrect += 1;
    marks -= test.negativeMarks;
    return {
      questionId: q.id,
      question: q.question,
      options: q.options,
      yourAnswer,
      correctAnswer: q.correctAnswer,
      status: "incorrect" as const,
    };
  });

  marks = Math.max(0, Math.round(marks * 100) / 100);
  const scored = correct + incorrect;
  const result: TestResult = {
    id: uid("res"),
    testId: test.id,
    testName: test.name,
    studentId: student.studentId,
    studentName: student.studentName,
    total: questions.length,
    attempted,
    correct,
    incorrect,
    unattempted,
    pending,
    marks,
    maxMarks,
    percentage: maxMarks > 0 ? Math.round((marks / maxMarks) * 1000) / 10 : 0,
    accuracy: scored > 0 ? Math.round((correct / scored) * 1000) / 10 : 0,
    timeTakenSec,
    details,
    createdAt: nowISO(),
    manual: false,
  };

  const attempt: TestAttempt = {
    id: uid("att"),
    testId: test.id,
    studentId: student.studentId,
    studentName: student.studentName,
    answers,
    marked: [],
    timeTakenSec,
    submittedAt: nowISO(),
  };
  saveAttempt(attempt);
  saveResult(result);
  try {
    window.localStorage.removeItem(`student_test_attempt_${test.id}_${student.studentId}`);
  } catch {
    /* ignore */
  }
  return result;
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
