// Phase 5 — Start attempt: STUDENT → IN_PROGRESS TestAttempt.
// Validates: active student, own-batch visible test, live window (server
// clock), test type allows online attempts. Reuses an existing IN_PROGRESS
// attempt; refuses when a SUBMITTED/EVALUATED attempt already exists
// (single-attempt rule; multi-attempt support later via maxAttempts).

import { NextRequest, NextResponse } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { batchAllowed, canStudentAccessTest, isLiveWindowOpen, resolveStudent, STUDENT_VISIBLE_STATUSES } from "@/lib/testAccess";
import { buildAttemptMappings, isValidQuestionMap, normalizeMode, presentLetters } from "@/lib/testOrdering";
import { remainingSeconds, sanitizeAutosaveAnswers } from "@/lib/attemptResume";

export const dynamic = "force-dynamic";
// Vercel: access checks + crypto ordering + attempt row + cold start (Pro plan).
export const maxDuration = 15;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: testId } = await params;
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Starting a test attempt");
  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile || profile.status !== "ACTIVE") return fail("Student profile not found or inactive.", 403);
    const test = await db.test.findUnique({ where: { id: testId }, include: { questions: { orderBy: { order: "asc" } } } });
    if (!test || !STUDENT_VISIBLE_STATUSES.includes(test.status as (typeof STUDENT_VISIBLE_STATUSES)[number])) {
      return fail("Test not found.", 404);
    }
    // Phase 14 — SCHOLARSHIP bypass for FREE tests (central gate re-checks).
    const freeBypass = profile.studentType === "SCHOLARSHIP" && test.accessType === "FREE";
    if (!freeBypass && !batchAllowed(profile.batchId, test.batchId)) return fail("Test not found.", 404);
    // Phase 13 — centralized FREE/PAID/PRIVATE gate (no bypass via direct API).
    const access = await canStudentAccessTest(db, profile.id, test.id);
    if (!access.allowed) return fail(access.reason, access.http);
    const window = isLiveWindowOpen(test.type, test.status, test.startTime, test.endTime);
    if (!window.open) return fail(window.reason ?? "This test is not open.", 400);
    const prior = await db.testAttempt.findFirst({
      where: { testId, studentId: profile.id },
      orderBy: { createdAt: "desc" },
    });
    if (prior && (prior.status === "SUBMITTED" || prior.status === "EVALUATED")) {
      return fail("You have already submitted this test.", 409);
    }
    if (prior && prior.status === "IN_PROGRESS") {
      // Resume: the row carries startedAt + any saved answers. serverNow lets
      // the client derive remaining time on the server clock (never reset).
      return ok({ attempt: prior, resumed: true, serverNow: new Date().toISOString() });
    }
    // Phase 12: generate per-attempt ordering ONCE (server-side, crypto
    // random). Stored on the attempt — refresh returns identical paper.
    // Every question is validated first: no null/empty mappings are created.
    const orderables = test.questions.map((q) => {
      const texts = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE];
      return { id: q.id, optionLetters: presentLetters(texts) };
    });
    const bad = orderables.find((o) => o.optionLetters.length < 2);
    if (bad) {
      return fail("This test contains a question with fewer than 2 options and cannot be attempted.", 422);
    }
    const mappings = buildAttemptMappings(
      orderables,
      normalizeMode(test.questionOrder),
      normalizeMode(test.optionOrder)
    );
    for (const o of orderables) {
      if (!isValidQuestionMap(mappings.optionMap[o.id], o.optionLetters)) {
        return fail("Could not prepare this test. Please try again.", 500);
      }
    }
    const attempt = await db.testAttempt.create({
      data: {
        testId,
        studentId: profile.id,
        status: "IN_PROGRESS",
        questionOrder: mappings.questionOrder,
        optionMap: mappings.optionMap,
      },
    });
    return ok({ attempt, resumed: false, serverNow: new Date().toISOString() }, 201);
  } catch (err) {
    return serverError("tests:attempt", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Answer autosave: STUDENT persists per-question answers on their OWN
  // IN_PROGRESS attempt. Durable draft only — scoring happens exclusively in
  // POST submit, which re-validates everything. Never trusts client marks.
  const { id: testId } = await params;
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Saving answers");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : null;
  if (!attemptId) return fail("attemptId is required.", 400);
  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile || profile.status !== "ACTIVE") return fail("Student profile not found or inactive.", 403);
    const attempt = await db.testAttempt.findUnique({ where: { id: attemptId } });
    // Ownership + test binding verified server-side; foreign/missing IDs get
    // a uniform 404 (no existence oracle, no cross-student writes).
    if (!attempt || attempt.testId !== testId || attempt.studentId !== profile.id) {
      return fail("Attempt not found.", 404);
    }
    if (attempt.status !== "IN_PROGRESS") {
      return fail("This attempt is already submitted and cannot be modified.", 409);
    }
    const test = await db.test.findUnique({ where: { id: testId } });
    if (!test) return fail("Test not found.", 404);
    const access = await canStudentAccessTest(db, profile.id, testId);
    if (!access.allowed) return fail(access.reason, access.http);
    const now = new Date();
    const remain = remainingSeconds({ startedAt: attempt.startedAt, durationMin: test.duration, serverNow: now });
    if (remain === null || remain <= 0) {
      return fail("Time is over for this attempt. Submit instead of saving.", 410);
    }
    if (test.type === "LIVE") {
      const window = isLiveWindowOpen(test.type, test.status, test.startTime, test.endTime, now);
      if (!window.open) return fail(window.reason ?? "The submission window has closed.", 410);
    }
    const qids = await db.question
      .findMany({ where: { testId }, select: { id: true }, take: 500 })
      .then((rows) => rows.map((q) => q.id))
      .catch(() => [] as string[]);
    const { clean, rejected } = sanitizeAutosaveAnswers(qids, body.answers);
    if (rejected.length > 0) {
      return fail(`Invalid answers rejected for: ${rejected.slice(0, 10).join(", ")}.`, 400);
    }
    // Optimistic concurrency: a stale writer (second tab, retried request)
    // must not silently overwrite newer answers. The client sends the
    // updatedAt it based its save on; a mismatch returns the current server
    // answers so the client can rebase and retry once.
    const base = typeof body.baseUpdatedAt === "string" ? new Date(body.baseUpdatedAt) : null;
    const baseValid = base instanceof Date && !Number.isNaN(base.getTime());
    let saved: { answers: unknown; updatedAt: Date } | null = null;
    if (baseValid) {
      const updated = await db.testAttempt.updateMany({
        where: { id: attempt.id, status: "IN_PROGRESS", updatedAt: base as Date },
        data: { answers: clean },
      });
      if (updated.count === 0) {
        const current = await db.testAttempt.findUnique({
          where: { id: attempt.id },
          select: { answers: true, updatedAt: true, status: true },
        });
        if (!current || current.status !== "IN_PROGRESS") {
          return fail("This attempt is already submitted and cannot be modified.", 409);
        }
        // Stale writer: hand back the current server answers + clock so the
        // client can rebase its dirty answers and retry exactly once.
        return NextResponse.json(
          {
            success: false,
            error: "Answers changed elsewhere. Rebase and retry.",
            code: "ATTEMPT_STALE",
            data: { answers: current.answers ?? {}, updatedAt: current.updatedAt.toISOString() },
          },
          { status: 409 }
        );
      }
      const fresh = await db.testAttempt.findUnique({ where: { id: attempt.id }, select: { answers: true, updatedAt: true } });
      saved = { answers: fresh?.answers ?? clean, updatedAt: fresh?.updatedAt ?? now };
    } else {
      const fresh = await db.testAttempt.update({
        where: { id: attempt.id },
        data: { answers: clean },
        select: { answers: true, updatedAt: true },
      });
      saved = { answers: fresh.answers, updatedAt: fresh.updatedAt };
    }
    return ok({ saved: true, answers: saved.answers, updatedAt: saved.updatedAt.toISOString(), serverNow: new Date().toISOString() });
  } catch (err) {
    return serverError("tests:attempt-save", err);
  }
}
