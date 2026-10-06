// Phase 14 — student-type scoping (server-side, Prisma).
// REGULAR = full academic experience. SCHOLARSHIP = scholarship/FREE tests +
// profile + notifications + enabled books only. Every route enforces this;
// the type is never trusted from the client.

import type { PrismaClient } from "@prisma/client";
import { resolveStudent } from "@/lib/testAccess";

type Db = PrismaClient;

export type StudentType = "REGULAR" | "SCHOLARSHIP";

export interface ScopedStudent {
  id: string;
  userId: string | null;
  batchId: string | null;
  status: string;
  studentType: StudentType;
  name: string;
}

/** Resolve the caller's own student profile with its server-side type. */
export async function getScopedStudent(db: Db, userId: string, email: string): Promise<ScopedStudent | null> {
  const base = await resolveStudent(db, userId, email);
  if (!base) return null;
  const row = await db.student.findUnique({
    where: { id: base.id },
    select: { id: true, userId: true, batchId: true, status: true, studentType: true, name: true },
  });
  if (!row) return null;
  return { ...row, studentType: row.studentType as StudentType };
}

/**
 * Require a REGULAR student (batches, attendance, marks, analytics,
 * regular tests). Returns an error response shape or null when allowed.
 */
export function requireRegular(student: ScopedStudent | null): { error: string; status: number } | null {
  if (!student || student.status !== "ACTIVE") {
    return { error: "Student profile not found or inactive.", status: 403 };
  }
  if (student.studentType !== "REGULAR") {
    return { error: "This section is available for regular students only.", status: 403 };
  }
  return null;
}

/** Strip every sensitive/internal field from a student row before responding. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeStudent<T extends Record<string, any>>(s: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(s as Record<string, unknown>) };
  const u = out.user as Record<string, unknown> | undefined;
  if (u && typeof u === "object") {
    const { passwordHash: _p, dobHash: _d, ...safe } = u;
    void _p;
    void _d;
    out.user = safe;
  }
  return out;
}

/** Fields a student may update on their OWN profile (allowlist). */
export const STUDENT_EDITABLE_FIELDS = [
  "name",
  "photoUrl",
  "gender",
  "address",
  "city",
  "school",
  "className",
  "parentName",
  "parentMobile",
] as const;

/** Fields that are NEVER student-editable (admin-only or system). */
export const STUDENT_PROTECTED_FIELDS = [
  "mobile",
  "phone",
  "email",
  "studentType",
  "status",
  "batchId",
  "courseId",
  "enrollmentDate",
  "joiningDate",
] as const;
