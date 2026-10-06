// Phase 3 — Student service (focused module).
// Canonical list/enroll/update flows live in services/adminApi.ts; this
// module adds student-scoped helpers (profile, attempts) for the future
// Student App. Demo fallback preserved — no DB required.

import { getStudents } from "@/services/adminApi";
import type { AdminStudent } from "@/data/admin";

export async function getStudentList(): Promise<AdminStudent[]> {
  return getStudents();
}

export async function getStudentById(id: string): Promise<AdminStudent | null> {
  const rows = await getStudents();
  return rows.find((s) => s.id === id || s.studentId === id) ?? null;
}
