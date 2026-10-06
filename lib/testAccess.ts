// Phase 5 — shared test-access helpers (server-side, Prisma).
// Single place for: student resolution, batch membership, faculty scope,
// live-window checks. API routes must use these — never reimplement.

import type { PrismaClient } from "@prisma/client";

type Db = PrismaClient;

export interface AccessStudent {
  id: string;
  batchId: string | null;
  status: string;
  // Phase 14 — server-side student type. SCHOLARSHIP students see every
  // published FREE test regardless of batch (user decision, Phase 14).
  studentType: string;
}

/** Resolve the Student profile for a session user (userId link, email fallback). */
export async function resolveStudent(db: Db, userId: string, email: string): Promise<AccessStudent | null> {
  const sel = { id: true, batchId: true, status: true, studentType: true };
  const byUser = await db.student.findUnique({ where: { userId }, select: sel }).catch(() => null);
  if (byUser) return { id: byUser.id, batchId: byUser.batchId, status: byUser.status, studentType: byUser.studentType };
  if (email) {
    const byEmail = await db.student.findUnique({ where: { email: email.toLowerCase() }, select: sel }).catch(() => null);
    if (byEmail) return { id: byEmail.id, batchId: byEmail.batchId, status: byEmail.status, studentType: byEmail.studentType };
  }
  return null;
}

/** Batch ids assigned to a faculty member (via Batch.facultyId → Faculty.userId). */
export async function facultyBatchIds(db: Db, facultyUserId: string): Promise<string[]> {
  const profile = await db.faculty.findUnique({ where: { userId: facultyUserId } }).catch(() => null);
  if (!profile) return [];
  const batches = await db.batch.findMany({ where: { facultyId: profile.id }, select: { id: true } });
  return batches.map((b) => b.id);
}

/** Statuses a student may ever see. Drafts are never visible. */
export const STUDENT_VISIBLE_STATUSES = ["PUBLISHED", "LIVE", "SCHEDULED", "COMPLETED"] as const;

/** Server-side live window check — never trust client clocks. */
export function isLiveWindowOpen(
  type: string,
  status: string,
  startTime: Date | null,
  endTime: Date | null,
  now = new Date()
): { open: boolean; reason?: string } {
  if (type === "OFFLINE") return { open: false, reason: "Offline tests are not attempted online." };
  if (type === "PRACTICE") {
    if (status !== "PUBLISHED" && status !== "LIVE") return { open: false, reason: "This practice test is not published." };
    return { open: true };
  }
  // LIVE
  if (status !== "LIVE" && status !== "PUBLISHED" && status !== "SCHEDULED") {
    return { open: false, reason: "This live test is not open." };
  }
  if (startTime && now < startTime) return { open: false, reason: "This test has not started yet." };
  if (endTime && now > endTime) return { open: false, reason: "The submission window has closed." };
  if (status !== "LIVE" && status !== "PUBLISHED") return { open: false, reason: "This live test is not open." };
  return { open: true };
}

/** Student may attempt only tests in their own batch (open tests: batchId null). */
export function batchAllowed(studentBatchId: string | null, testBatchId: string | null): boolean {
  if (!testBatchId) return true;
  return !!studentBatchId && studentBatchId === testBatchId;
}

// ---------------------------------------------------------------------------
// Phase 13 — CENTRALIZED test access authorization.
// ALL student-facing test routes MUST use canStudentAccessTest — never
// reimplement these rules. Single source of truth for FREE / PAID / PRIVATE.
//
// Rules:
// - FREE:    allowed when the test is published/live, active, and the student
//            is otherwise eligible (active profile + batch rule).
// - PAID:    allowed ONLY with an ACTIVE, unexpired TestAccess grant.
// - PRIVATE: allowed ONLY with an ACTIVE, unexpired TestAccess grant.
// - Expired / revoked access: denied. Draft / deactivated tests: denied
//   (returned as 404 so students cannot probe unpublished tests).
// ---------------------------------------------------------------------------

export type AccessDecision =
  | { allowed: true; via: "FREE" | "GRANT"; accessId: string | null }
  | {
      allowed: false;
      code:
        | "NOT_FOUND"
        | "NOT_PUBLISHED"
        | "INACTIVE_STUDENT"
        | "BATCH"
        | "LOCKED"
        | "EXPIRED"
        | "REVOKED"
        | "HIDDEN";
      reason: string;
      http: 403 | 404 | 410;
    };

export interface AccessTestRow {
  id: string;
  status: string;
  isActive: boolean;
  batchId: string | null;
  accessType: string;
  price: number;
}

export interface AccessGrantRow {
  id: string;
  status: string;
  expiresAt: Date | null;
}

/**
 * Decide whether a student profile may access a test.
 * Pure decision over already-loaded rows — no DB inside (callers fetch).
 */
export function decideAccess(
  student: { id: string; batchId: string | null; status: string; studentType?: string } | null,
  test: AccessTestRow | null,
  grant: AccessGrantRow | null,
  now = new Date()
): AccessDecision {
  if (!test) return { allowed: false, code: "NOT_FOUND", reason: "Test not found.", http: 404 };
  if (!test.isActive) return { allowed: false, code: "NOT_FOUND", reason: "Test not found.", http: 404 };
  if (test.status === "DRAFT") return { allowed: false, code: "NOT_PUBLISHED", reason: "Test not found.", http: 404 };
  if (!student || student.status !== "ACTIVE") {
    return { allowed: false, code: "INACTIVE_STUDENT", reason: "Student profile not found or inactive.", http: 403 };
  }
  // Phase 14 — SCHOLARSHIP students see every published FREE test regardless
  // of batch. The batch rule still applies to everyone else and to all
  // PAID/PRIVATE tests.
  const freeForAll = (test.accessType ?? "FREE") === "FREE" && student.studentType === "SCHOLARSHIP";
  if (!freeForAll && !batchAllowed(student.batchId, test.batchId)) {
    return { allowed: false, code: "BATCH", reason: "Test not found.", http: 404 };
  }
  const accessType = test.accessType ?? "FREE";
  if (accessType === "FREE") {
    if (test.status !== "PUBLISHED" && test.status !== "LIVE") {
      return { allowed: false, code: "NOT_PUBLISHED", reason: "Test not found.", http: 404 };
    }
    return { allowed: true, via: "FREE", accessId: null };
  }
  // PAID / PRIVATE — a grant is mandatory.
  if (!grant) {
    if (accessType === "PRIVATE") {
      // Hide existence of private tests (existing security convention).
      return { allowed: false, code: "HIDDEN", reason: "Test not found.", http: 404 };
    }
    return {
      allowed: false,
      code: "LOCKED",
      reason: `This is a paid test (₹${test.price}). Contact the academy after payment to unlock access.`,
      http: 403,
    };
  }
  if (grant.status === "REVOKED") {
    return { allowed: false, code: "REVOKED", reason: "Your access to this test has been revoked. Contact the academy office.", http: 403 };
  }
  if (grant.status === "EXPIRED" || (grant.expiresAt && grant.expiresAt.getTime() < now.getTime())) {
    return { allowed: false, code: "EXPIRED", reason: "Your access to this test has expired. Contact the academy office.", http: 410 };
  }
  if (grant.status !== "ACTIVE") {
    return { allowed: false, code: "LOCKED", reason: "You do not have access to this test.", http: 403 };
  }
  return { allowed: true, via: "GRANT", accessId: grant.id };
}

/** Fetch rows and decide — the ONE function routes call. */
export async function canStudentAccessTest(
  db: Db,
  studentId: string,
  testId: string,
  now = new Date()
): Promise<AccessDecision> {
  const [student, test] = await Promise.all([
    db.student.findUnique({ where: { id: studentId }, select: { id: true, batchId: true, status: true, studentType: true } }),
    db.test.findUnique({ where: { id: testId }, select: { id: true, status: true, isActive: true, batchId: true, accessType: true, price: true } }),
  ]);
  if (!test) return { allowed: false, code: "NOT_FOUND", reason: "Test not found.", http: 404 };
  if (!test.isActive || test.status === "DRAFT") {
    return { allowed: false, code: "NOT_PUBLISHED", reason: "Test not found.", http: 404 };
  }
  if (!student || student.status !== "ACTIVE") {
    return { allowed: false, code: "INACTIVE_STUDENT", reason: "Student profile not found or inactive.", http: 403 };
  }
  // Phase 14 — SCHOLARSHIP bypass for FREE tests (see decideAccess).
  const freeForAll = test.accessType === "FREE" && student.studentType === "SCHOLARSHIP";
  if (!freeForAll && !batchAllowed(student.batchId, test.batchId)) {
    return { allowed: false, code: "BATCH", reason: "Test not found.", http: 404 };
  }
  if (test.accessType === "FREE") {
    if (test.status !== "PUBLISHED" && test.status !== "LIVE") {
      return { allowed: false, code: "NOT_PUBLISHED", reason: "Test not found.", http: 404 };
    }
    return { allowed: true, via: "FREE", accessId: null };
  }
  const grant = await db.testAccess.findFirst({
    where: { testId, studentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, expiresAt: true },
  });
  const decision = decideAccess(student, test, grant, now);
  // Lazy expiry: an ACTIVE grant past expiresAt is marked EXPIRED so the
  // admin console reflects reality. Best-effort — never fails the check.
  if (grant && grant.status === "ACTIVE" && grant.expiresAt && grant.expiresAt.getTime() < now.getTime()) {
    try {
      await db.testAccess.update({ where: { id: grant.id }, data: { status: "EXPIRED" } });
    } catch {
      /* read path stays authoritative */
    }
  }
  return decision;
}

/** Validate accessType + price for admin writes. Returns an error or null. */
export function validateAccessFields(accessType: unknown, price: unknown): string | null {
  const t = typeof accessType === "string" ? accessType.toUpperCase() : "FREE";
  if (t !== "FREE" && t !== "PAID" && t !== "PRIVATE") return "accessType must be FREE, PAID or PRIVATE.";
  const p = typeof price === "number" ? price : t === "FREE" ? 0 : undefined;
  if (t === "FREE" && p !== undefined && p !== 0) return "FREE tests must have price 0.";
  if (t === "PAID") {
    if (p === undefined || !Number.isFinite(p) || Math.floor(p) !== p || p <= 0) {
      return "PAID tests require a positive integer price (rupees).";
    }
    if (p > 100000) return "Price looks too high (max ₹100000).";
  }
  if (p !== undefined && (!Number.isFinite(p) || Math.floor(p) !== p || p < 0)) {
    return "Price must be a non-negative integer (rupees).";
  }
  return null;
}

/** Normalize admin input to Prisma-safe { accessType, price }. */
export function normalizeAccessFields(accessType: unknown, price: unknown): { accessType: "FREE" | "PAID" | "PRIVATE"; price: number } {
  const t = typeof accessType === "string" ? accessType.toUpperCase() : "FREE";
  const at = t === "PAID" ? "PAID" : t === "PRIVATE" ? "PRIVATE" : "FREE";
  if (at === "FREE") return { accessType: at, price: 0 };
  const p = typeof price === "number" && Number.isFinite(price) ? Math.max(0, Math.floor(price)) : 0;
  return { accessType: at, price: at === "PAID" && p <= 0 ? 0 : p };
}
