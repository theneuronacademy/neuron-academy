// Phase 3 — Faculty service (focused module).
// Canonical flows live in services/adminApi.ts; this module adds
// faculty-scoped helpers for the future Faculty App. Demo fallback preserved.

import { getBatches, getFaculty } from "@/services/adminApi";
import type { AdminFaculty } from "@/data/admin";

export async function getFacultyList(): Promise<AdminFaculty[]> {
  return getFaculty();
}

export async function getFacultyById(id: string): Promise<AdminFaculty | null> {
  const rows = await getFaculty();
  return rows.find((f) => f.id === id) ?? null;
}

// TODO backend: GET /api/batches?facultyId= (assigned batches, Phase 4)
export async function getFacultyBatches(facultyName: string) {
  const batches = await getBatches();
  return batches.filter((b) => b.faculty === facultyName);
}
