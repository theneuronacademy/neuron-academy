// Phase 5 — shared test-access helpers (server-side, Prisma).
// Single place for: student resolution, batch membership, faculty scope,
// live-window checks. API routes must use these — never reimplement.

import type { PrismaClient } from "@prisma/client";

type Db = PrismaClient;

export interface AccessStudent {
  id: string;
  batchId: string | null;
  status: string;
}

/** Resolve the Student profile for a session user (userId link, email fallback). */
export async function resolveStudent(db: Db, userId: string, email: string): Promise<AccessStudent | null> {
  const byUser = await db.student.findUnique({ where: { userId } }).catch(() => null);
  if (byUser) return { id: byUser.id, batchId: byUser.batchId, status: byUser.status };
  if (email) {
    const byEmail = await db.student.findUnique({ where: { email: email.toLowerCase() } }).catch(() => null);
    if (byEmail) return { id: byEmail.id, batchId: byEmail.batchId, status: byEmail.status };
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
