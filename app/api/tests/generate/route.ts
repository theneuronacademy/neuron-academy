// Phase 12 — test generator: pool → configured test (server-side).
// Selection: MANUAL (explicit ids) | RANDOM (shuffle, take N) | SERIAL
// (stored order, take N). Shuffles use crypto randomness. Copied questions
// become first-class rows on the new test (no shared references, no dupes).
// Publish safety is enforced separately on PATCH …/tests/[id].

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds, normalizeAccessFields, validateAccessFields } from "@/lib/testAccess";
import { normalizeMode, shuffle, type OrderMode } from "@/lib/testOrdering";
import { isNonEmpty, missingFields, parseDate } from "@/lib/validation";

export const dynamic = "force-dynamic";
// Vercel: pool read + up to 200-row createMany + cold start (Pro plan).
export const maxDuration = 30;

const TYPES = ["LIVE", "OFFLINE", "PRACTICE"] as const;

async function facultyScopeOk(
  db: NonNullable<ReturnType<typeof getDb>>,
  userId: string,
  testIds: string[]
): Promise<boolean> {
  if (testIds.length === 0) return true;
  const batchIds = await facultyBatchIds(db, userId);
  const tests = await db.test.findMany({ where: { id: { in: testIds } }, select: { id: true, createdById: true, batchId: true } });
  if (tests.length !== testIds.length) return false;
  return tests.every((t) => t.createdById === userId || (t.batchId !== null && batchIds.includes(t.batchId)));
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Generating a test");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["title"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);

  const selectionMode = String(body.selectionMode ?? "MANUAL").toUpperCase();
  if (selectionMode !== "MANUAL" && selectionMode !== "RANDOM" && selectionMode !== "SERIAL") {
    return fail("selectionMode must be MANUAL, RANDOM or SERIAL.", 400);
  }
  const count = typeof body.count === "number" ? Math.floor(body.count) : 0;
  const questionIds = Array.isArray(body.questionIds)
    ? body.questionIds.filter((x): x is string => typeof x === "string")
    : [];
  const sourceTestIds = Array.isArray(body.sourceTestIds)
    ? body.sourceTestIds.filter((x): x is string => typeof x === "string")
    : [];
  if (selectionMode === "MANUAL" && questionIds.length === 0) {
    return fail("MANUAL mode requires questionIds.", 400);
  }
  if ((selectionMode === "RANDOM" || selectionMode === "SERIAL") && (!count || count <= 0)) {
    return fail("RANDOM/SERIAL mode requires a positive count.", 400);
  }
  if (count > 200) return fail("Count must not exceed 200 questions.", 400);
  if (auth.user.role === "FACULTY" && !(await facultyScopeOk(db, auth.user.id, sourceTestIds))) {
    return fail("You can generate only from your own or assigned-batch tests.", 403);
  }
  // Phase 13 — only ADMIN may set access type / price. Faculty tests are FREE.
  if (auth.user.role === "FACULTY" && (body.accessType !== undefined || body.price !== undefined)) {
    return fail("Only admins can set test access type or price.", 403);
  }
  const accessErr = auth.user.role === "ADMIN" ? validateAccessFields(body.accessType, body.price) : null;
  if (accessErr) return fail(accessErr, 400);
  const access = normalizeAccessFields(body.accessType, body.price);
  const questionOrder: OrderMode = normalizeMode(body.questionOrder);
  const optionOrder: OrderMode = normalizeMode(body.optionOrder);
  const marksPerQuestion = typeof body.marksPerQuestion === "number" && body.marksPerQuestion > 0 ? body.marksPerQuestion : null;
  const negativeMarks = typeof body.negativeMarks === "number" && body.negativeMarks >= 0 ? body.negativeMarks : null;

  try {
    // Pool: APPROVED questions from the source tests (staging or bank tests).
    const poolWhere =
      selectionMode === "MANUAL"
        ? { id: { in: [...new Set(questionIds)] }, reviewStatus: "APPROVED" }
        : { testId: { in: sourceTestIds }, reviewStatus: "APPROVED" };
    const pool = await db.question.findMany({ where: poolWhere, orderBy: [{ testId: "asc" }, { order: "asc" }] });
    if (selectionMode === "MANUAL" && pool.length !== [...new Set(questionIds)].length) {
      return fail("Some selected questions are not approved or not accessible.", 400);
    }
    let picked = pool;
    if (selectionMode === "RANDOM") {
      if (pool.length < count) {
        return fail(`Pool has ${pool.length} approved question(s); requested ${count}. Lower the count or approve more.`, 400);
      }
      picked = shuffle(pool).slice(0, count);
    } else if (selectionMode === "SERIAL") {
      if (pool.length < count) {
        return fail(`Pool has ${pool.length} approved question(s); requested ${count}. Lower the count or approve more.`, 400);
      }
      picked = pool.slice(0, count);
    }
    if (picked.length === 0) return fail("No questions selected.", 400);

    const copies = picked.map((q, i) => ({
      questionText: q.questionText,
      questionType: q.questionType,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      optionE: q.optionE,
      correctAnswer: q.correctAnswer,
      marks: marksPerQuestion ?? q.marks,
      negativeMarks: negativeMarks ?? q.negativeMarks,
      explanation: q.explanation,
      order: i,
      subject: q.subject,
      sourceFile: q.sourceFile,
      sourcePage: q.sourcePage,
      confidence: q.confidence,
      reviewStatus: "APPROVED",
    }));
    const totalMarks = typeof body.totalMarks === "number" && body.totalMarks > 0
      ? body.totalMarks
      : Math.round(copies.reduce((n, q) => n + q.marks, 0) * 100) / 100;

    const test = await db.test.create({
      data: {
        title: String(body.title).slice(0, 120),
        description: typeof body.description === "string" ? body.description.slice(0, 500) : undefined,
        batchId: isNonEmpty(body.batchId) ? String(body.batchId) : undefined,
        createdById: auth.user.id,
        type: TYPES.includes(body.type as (typeof TYPES)[number]) ? (body.type as (typeof TYPES)[number]) : "PRACTICE",
        duration: typeof body.duration === "number" && body.duration > 0 ? Math.floor(body.duration) : 60,
        totalQuestions: copies.length,
        totalMarks,
        startTime: parseDate(body.startTime),
        endTime: parseDate(body.endTime),
        status: "DRAFT",
        questionOrder,
        optionOrder,
        ...(auth.user.role === "ADMIN" ? { accessType: access.accessType, price: access.price } : {}),
      },
    });
    await db.question.createMany({ data: copies.map((c) => ({ ...c, testId: test.id })) });
    const questions = await db.question.findMany({ where: { testId: test.id }, orderBy: { order: "asc" } });
    return ok({ item: test, questions, preview: { questionOrder, optionOrder } }, 201);
  } catch (err) {
    return serverError("tests:generate", err);
  }
}
