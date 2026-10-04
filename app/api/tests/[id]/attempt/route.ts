// Phase 5 — Start attempt: STUDENT → IN_PROGRESS TestAttempt.
// Validates: active student, own-batch visible test, live window (server
// clock), test type allows online attempts. Reuses an existing IN_PROGRESS
// attempt; refuses when a SUBMITTED/EVALUATED attempt already exists
// (single-attempt rule; multi-attempt support later via maxAttempts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { batchAllowed, isLiveWindowOpen, resolveStudent, STUDENT_VISIBLE_STATUSES } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: testId } = await params;
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Starting a test attempt");
  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile || profile.status !== "ACTIVE") return fail("Student profile not found or inactive.", 403);
    const test = await db.test.findUnique({ where: { id: testId } });
    if (!test || !STUDENT_VISIBLE_STATUSES.includes(test.status as (typeof STUDENT_VISIBLE_STATUSES)[number])) {
      return fail("Test not found.", 404);
    }
    if (!batchAllowed(profile.batchId, test.batchId)) return fail("Test not found.", 404);
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
    const attempt = await db.testAttempt.create({
      data: { testId, studentId: profile.id, status: "IN_PROGRESS" },
    });
    return ok({ attempt, resumed: false }, 201);
  } catch (err) {
    return serverError("tests:attempt", err);
  }
}
