// Faculty directory (public-safe fields only — no student data here).

export interface FacultyMember {
  id: string;
  name: string;
  designation: string;
  subject: string;
  qualification: string;
  experience: string;
  intro: string;
  image: string;
  profileUrl: string;
}

export const FACULTY: FacultyMember[] = [
  // Phase 10: demo profiles removed. Publish real faculty via
  // /admin/website/faculty (database) — the section shows an empty state until then.
];
