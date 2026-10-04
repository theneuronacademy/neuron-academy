// Phase 4 — ownership helpers (prepare row-level rules).
// Covered by existing relations, no schema change needed:
// - Student → own rows via Student.userId / TestAttempt.studentId / Attendance.studentId.
// - Faculty → assigned batches via Batch.facultyId; assigned students = students in those batches.
// - Admin → full access.
// Complex checks (e.g. "faculty may grade only their batch's tests") stay
// TODO until the attempt/grading flows are API-backed in a later phase.

import type { AppRole } from "@/lib/server-auth";

export interface Viewer {
  id: string; // User.id
  role: AppRole;
}

export function isAdmin(viewer: Viewer | null): boolean {
  return viewer?.role === "ADMIN";
}

/** Student may access only their own student-profile id. Admins bypass. */
export function canViewStudent(viewer: Viewer | null, ownerUserId: string | null): boolean {
  if (!viewer) return false;
  if (viewer.role === "ADMIN") return true;
  if (viewer.role === "STUDENT") return viewer.id === ownerUserId;
  // TODO Phase 5: FACULTY may view students of assigned batches (needs batch membership check).
  return false;
}

/** Faculty may act on batches assigned to them (Batch.facultyId → Faculty.userId). Admins bypass. */
export function canManageBatch(viewer: Viewer | null, batchFacultyUserId: string | null): boolean {
  if (!viewer) return false;
  if (viewer.role === "ADMIN") return true;
  if (viewer.role === "FACULTY") return viewer.id === batchFacultyUserId;
  return false;
}

/**
 * Remaining relationship requirements for full ownership (Phase 5+):
 * - Test → Batch link exists (Test.batchId) — faculty test ownership derives from batch assignment.
 * - TestAttempt/Result → Student link exists — student result visibility derives from own profile.
 * - Notification targeting uses targetBatchId/targetStudentId/targetFacultyId — audience checks derive from these.
 * - No new tables needed for basic rules; grading/marks audit log is the only likely addition.
 */
export const OWNERSHIP_NOTES = "See comments above." as const;
