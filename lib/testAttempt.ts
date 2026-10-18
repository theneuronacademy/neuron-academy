// Phase 20 — Multi-Attempt Test Logic
// Handles attempt limits, retakes, and practice mode

import { PrismaClient } from "@prisma/client";

type Db = PrismaClient;

export interface AttemptCheckResult {
  allowed: boolean;
  reason?: string;
  http?: number;
  existingAttempt?: {
    id: string;
    attemptNumber: number;
    status: string;
    startedAt: Date;
    score?: number;
  };
  nextAttemptNumber: number;
}

/**
 * Check if student can start a new attempt
 * - Respects test.maxAttempts
 * - Allows practice mode unlimited retakes
 * - Blocks if max attempts reached
 */
export async function checkAttemptEligibility(
  db: Db,
  testId: string,
  studentId: string
): Promise<AttemptCheckResult> {
  const test = await db.test.findUnique({
    where: { id: testId },
    select: { id: true, maxAttempts: true, type: true, isHomework: true, status: true, isActive: true },
  });

  if (!test || !test.isActive) {
    return { allowed: false, reason: "Test not found.", http: 404, nextAttemptNumber: 1 };
  }

  if (test.status === "DRAFT") {
    return { allowed: false, reason: "Test not available.", http: 404, nextAttemptNumber: 1 };
  }

  // Practice tests and homework allow unlimited retakes
  const isPractice = test.type === "PRACTICE" || test.isHomework;

  // Get existing attempts
  const attempts = await db.testAttempt.findMany({
    where: { testId, studentId },
    orderBy: { attemptNumber: "desc" },
    select: { id: true, attemptNumber: true, status: true, startedAt: true, score: true },
    take: 10,
  });

  const completedAttempts = attempts.filter((a) => a.status === "SUBMITTED" || a.status === "EVALUATED");
  const inProgressAttempt = attempts.find((a) => a.status === "IN_PROGRESS");

  // If there's an in-progress attempt, allow resume
  if (inProgressAttempt) {
    return {
      allowed: true,
      reason: "Resuming in-progress attempt.",
      existingAttempt: inProgressAttempt,
      nextAttemptNumber: inProgressAttempt.attemptNumber,
    };
  }

  // Check attempt limit
  if (!isPractice && completedAttempts.length >= test.maxAttempts) {
    const lastAttempt = completedAttempts[0];
    return {
      allowed: false,
      reason: `Maximum attempts (${test.maxAttempts}) reached.`,
      http: 403,
      existingAttempt: lastAttempt,
      nextAttemptNumber: test.maxAttempts + 1,
    };
  }

  // Determine next attempt number
  const nextAttemptNumber = completedAttempts.length + 1;

  return {
    allowed: true,
    nextAttemptNumber,
  };
}

/**
 * Create a new attempt or resume existing
 */
export async function createOrResumeAttempt(
  db: Db,
  testId: string,
  studentId: string
): Promise<{ attempt: { id: string; attemptNumber: number }; resumed: boolean }> {
  const eligibility = await checkAttemptEligibility(db, testId, studentId);
  if (!eligibility.allowed) {
    throw new Error(eligibility.reason ?? "Not allowed to attempt this test.");
  }

  // If resuming in-progress
  if (eligibility.existingAttempt?.status === "IN_PROGRESS") {
    return { attempt: { id: eligibility.existingAttempt.id, attemptNumber: eligibility.existingAttempt.attemptNumber }, resumed: true };
  }

  // Create new attempt
  const attempt = await db.testAttempt.create({
    data: {
      testId,
      studentId,
      status: "IN_PROGRESS",
      attemptNumber: eligibility.nextAttemptNumber,
    },
  });

  return { attempt: { id: attempt.id, attemptNumber: attempt.attemptNumber }, resumed: false };
}

/**
 * Get attempt history for a student on a test
 */
export async function getAttemptHistory(
  db: Db,
  testId: string,
  studentId: string
): Promise<Array<{ id: string; attemptNumber: number; status: string; score: number | null; percentage: number | null; startedAt: Date; submittedAt: Date | null }>> {
  return db.testAttempt.findMany({
    where: { testId, studentId },
    orderBy: { attemptNumber: "desc" },
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      score: true,
      percentage: true,
      startedAt: true,
      submittedAt: true,
    },
  });
}