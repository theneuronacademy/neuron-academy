// Phase 5 — Questions API.
// ADMIN/FACULTY: full rows (answer keys). STUDENT: only via ?testId= for a
// visible published test in their batch — answers + explanations stripped.
// PDF import pipeline: POST /api/tests/import/pdf (see services/pdfImport.ts,
// services/ocrService.ts, services/questionParser.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { batchAllowed, canStudentAccessTest, resolveStudent, STUDENT_VISIBLE_STATUSES } from "@/lib/testAccess";
import { assemblePaper } from "@/lib/testOrdering";
import { isNonEmpty, missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

const QTYPES = ["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "NUMERIC"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validOptionMap(v: any): Record<string, string[]> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string[]> = {};
  for (const [k, arr] of Object.entries(v)) {
    if (typeof k !== "string" || !Array.isArray(arr)) return null;
    if (!arr.every((x) => typeof x === "string" && /^[A-E]$/.test(x))) return null;
    out[k] = arr as string[];
  }
  return out;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  // P0: question rows carry answer keys — never answer from demo data; fail
  // honestly (503) when no database is configured, like attempts/books.
  if (!db) return dbNotConfigured("Reading questions");
  const viewer = getUserFromRequest(req);
  const testId = new URL(req.url).searchParams.get("testId");
  // Student branch: answer-free questions for one visible test.
  // With ?attemptId=, the paper applies the attempt's stored server-side
  // ordering (stable across refresh); otherwise stored question order.
  if (viewer?.role === "STUDENT") {
    if (!testId) return fail("testId is required.", 400);
    try {
      const test = await db.test.findUnique({ where: { id: testId } });
      if (!test || !STUDENT_VISIBLE_STATUSES.includes(test.status as (typeof STUDENT_VISIBLE_STATUSES)[number])) {
        return fail("Test not found.", 404);
      }
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      // Phase 14 — SCHOLARSHIP bypass for FREE tests (central gate re-checks).
      const freeBypass = !!profile && profile.studentType === "SCHOLARSHIP" && test.accessType === "FREE";
      if (!profile || profile.status !== "ACTIVE" || (!freeBypass && !batchAllowed(profile.batchId, test.batchId))) {
        return fail("Test not found.", 404);
      }
      // Phase 13 — centralized FREE/PAID/PRIVATE gate: question data (and
      // therefore the paper) never leaves the server without authorization.
      const access = await canStudentAccessTest(db, profile.id, test.id);
      if (!access.allowed) return fail(access.reason, access.http);
      const rows = await db.question.findMany({ where: { testId }, orderBy: { order: "asc" }, take: 500 });
      const attemptId = new URL(req.url).searchParams.get("attemptId");
      let questionOrder: string[] | null = null;
      let optionMap: Record<string, string[]> | null = null;
      if (attemptId) {
        const attempt = await db.testAttempt.findUnique({ where: { id: attemptId } });
        if (!attempt || attempt.testId !== testId || attempt.studentId !== profile.id) {
          return fail("Attempt not found.", 404);
        }
        if (attempt.status !== "IN_PROGRESS") {
          return fail("This attempt is already submitted.", 409);
        }
        questionOrder = Array.isArray(attempt.questionOrder) ? (attempt.questionOrder as string[]) : null;
        optionMap = validOptionMap(attempt.optionMap);
      }
      const paper = assemblePaper(
        rows.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          options: [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE],
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          order: q.order,
        })),
        questionOrder,
        optionMap
      );
      return ok({ items: paper, source: "database" });
    } catch (err) {
      return serverError("questions:list", err);
    }
  }
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  try {
    const url = new URL(req.url);
    const subject = url.searchParams.get("subject");
    const reviewStatus = url.searchParams.get("reviewStatus");
    const rows = await db.question.findMany({
      where: {
        ...(testId ? { testId } : {}),
        ...(subject ? { subject } : {}),
        ...(reviewStatus === "PENDING" || reviewStatus === "APPROVED" || reviewStatus === "REJECTED"
          ? { reviewStatus }
          : {}),
      },
      orderBy: { order: "asc" },
      take: 500,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("questions:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating a question");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["testId", "questionText"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  try {
    const created = await db.question.create({
      data: {
        testId: String(body.testId),
        questionText: String(body.questionText),
        questionType: QTYPES.includes(body.questionType as (typeof QTYPES)[number]) ? (body.questionType as (typeof QTYPES)[number]) : "MCQ",
        optionA: isNonEmpty(body.optionA) ? String(body.optionA) : undefined,
        optionB: isNonEmpty(body.optionB) ? String(body.optionB) : undefined,
        optionC: isNonEmpty(body.optionC) ? String(body.optionC) : undefined,
        optionD: isNonEmpty(body.optionD) ? String(body.optionD) : undefined,
        optionE: isNonEmpty(body.optionE) ? String(body.optionE) : undefined,
        correctAnswer: typeof body.correctAnswer === "string" ? body.correctAnswer : undefined,
        marks: typeof body.marks === "number" ? body.marks : 1,
        negativeMarks: typeof body.negativeMarks === "number" ? body.negativeMarks : 0,
        explanation: typeof body.explanation === "string" ? body.explanation : undefined,
        order: typeof body.order === "number" ? body.order : 0,
        subject: typeof body.subject === "string" ? body.subject.slice(0, 60) : undefined,
        sourceFile: typeof body.sourceFile === "string" ? body.sourceFile.slice(0, 200) : undefined,
        sourcePage: typeof body.sourcePage === "number" ? body.sourcePage : undefined,
        confidence: body.confidence === "HIGH" || body.confidence === "MEDIUM" || body.confidence === "LOW" ? body.confidence : undefined,
        reviewStatus: body.reviewStatus === "PENDING" || body.reviewStatus === "APPROVED" || body.reviewStatus === "REJECTED" ? body.reviewStatus : undefined,
      },
    });
    await db.test.update({ where: { id: String(body.testId) }, data: { totalQuestions: { increment: 1 } } }).catch(() => null);
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("questions:create", err);
  }
}
