// Phase 5 — Start attempt: STUDENT → IN_PROGRESS TestAttempt.
// Validates: active student, own-batch visible test, live window (server
// clock), test type allows online attempts. Reuses an existing IN_PROGRESS
// attempt; refuses when a SUBMITTED/EVALUATED attempt already exists
// (single-attempt rule; multi-attempt support later via maxAttempts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { batchAllowed, canStudentAccessTest, isLiveWindowOpen, resolveStudent, STUDENT_VISIBLE_STATUSES } from "@/lib/testAccess";
import { buildAttemptMappings, isValidQuestionMap, normalizeMode, presentLetters } from "@/lib/testOrdering";

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
      return ok({ attempt: prior, resumed: true });
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
    return ok({ attempt, resumed: false }, 201);
  } catch (err) {
    return serverError("tests:attempt", err);
  }
}
