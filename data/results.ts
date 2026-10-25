// Results / achievements.
// Phase 10: demo selections removed. Publish verified results via
// /admin/website/results (database) — empty state shows until then.

export interface AcademyResult {
  id: string;
  name: string;
  score: string;
  tag: string;
  exam: string;
  year: string;
  // Optional row photo + student-specific description (admin-managed via
  // the results-showcase CMS; legacy/static rows omit both).
  image?: string;
  description?: string;
  color: string;
}

export const RESULTS: AcademyResult[] = [];
