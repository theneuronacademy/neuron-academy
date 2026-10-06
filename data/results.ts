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
  color: string;
}

export const RESULTS: AcademyResult[] = [];
