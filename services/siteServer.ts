// Public website data for SERVER components — database-first with static fallback.
// SERVER-ONLY: imports lib/prisma (node-postgres). Never import this file
// from client components — browser pages must use services/siteApi instead.
//
// Publication rules (never relaxed here):
// - Courses: only status ACTIVE rows are public (ADMIN catalogue sees all).
// - Faculty: only status ACTIVE rows, with an explicit public field select —
//   email, phone and userId never leave the server for public pages.
// - Unknown slugs resolve to null (pages render proper 404s). Genuine DB
//   errors fall back to the static catalogue for known demo slugs only;
//   unknown slugs still 404 so errors are never masked as content.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

import { COURSES, type Course } from "@/data/courses";
import { FACULTY, type FacultyMember } from "@/data/faculty";
import { getDb } from "@/lib/prisma";

function cleanSlug(slug: unknown): string | null {
  if (typeof slug !== "string") return null;
  const s = slug.trim().slice(0, 80);
  return s ? s : null;
}

function toCourse(row: {
  slug?: string;
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  target?: string | null;
  duration?: string | null;
  mode?: string | null;
  facultyName?: string | null;
  image?: string | null;
  accent?: string | null;
  badge?: string | null;
  subjects?: string[];
  highlights?: string[];
  status?: string;
}): Course {
  return {
    id: String(row.slug ?? row.id),
    name: String(row.name),
    category: String(row.category ?? "Engineering"),
    desc: String(row.description ?? row.shortDescription ?? ""),
    target: String(row.target ?? "Class 11–12"),
    duration: String(row.duration ?? "1 year"),
    mode: String(row.mode ?? "Offline + Online"),
    faculty: String(row.facultyName ?? "Neuron Faculty"),
    imageLabel: String(row.name),
    image: String(row.image ?? ""),
    accent: String(row.accent ?? "#1AA6B5"),
    badge: String(row.badge ?? ""),
    subjects: Array.isArray(row.subjects) ? row.subjects.filter((s): s is string => typeof s === "string") : [],
    highlights: Array.isArray(row.highlights) ? row.highlights.filter((s): s is string => typeof s === "string") : [],
    admissionOpen: row.status !== "INACTIVE",
  } as Course;
}

function toFacultyMember(row: {
  id: string;
  name: string;
  designation?: string | null;
  subject?: string | null;
  qualification?: string | null;
  experience?: string | null;
  bio?: string | null;
  photo?: string | null;
}): FacultyMember {
  return {
    id: String(row.id),
    name: String(row.name),
    designation: String(row.designation ?? "Faculty"),
    subject: String(row.subject ?? "General"),
    qualification: String(row.qualification ?? ""),
    experience: String(row.experience ?? ""),
    intro: String(row.bio ?? row.qualification ?? ""),
    image: String(row.photo ?? ""),
    profileUrl: "#faculty",
  };
}

/** Published course slugs for prerendering (DB ACTIVE rows, else demo slugs). */
export async function getPublishedCourseSlugs(): Promise<string[]> {
  try {
    const db: Db = getDb();
    if (db) {
      const rows = await db.course.findMany({ where: { status: "ACTIVE" }, select: { slug: true }, take: 200 });
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map((r: { slug: string }) => String(r.slug)).filter(Boolean);
      }
    }
  } catch {
    /* static fallback below */
  }
  return COURSES.map((c) => c.id);
}

/** Published faculty IDs for prerendering (DB ACTIVE rows, else static list). */
export async function getPublishedFacultySlugs(): Promise<string[]> {
  try {
    const db: Db = getDb();
    if (db) {
      const rows = await db.faculty.findMany({ where: { status: "ACTIVE" }, select: { id: true }, take: 200 });
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map((r: { id: string }) => String(r.id)).filter(Boolean);
      }
    }
  } catch {
    /* static fallback below */
  }
  return FACULTY.map((f) => f.id);
}

/** Resolve a course by its real database slug (ACTIVE only). Demo slugs
 * resolve from the static catalogue when the DB is down or lacks the row;
 * anything else is null (proper 404). */
export async function getPublicCourseBySlug(slug: unknown): Promise<Course | null> {
  const key = cleanSlug(slug);
  if (!key) return null;
  try {
    const db: Db = getDb();
    if (db) {
      const row = await db.course.findFirst({ where: { slug: key, status: "ACTIVE" } });
      if (row) return toCourse(row);
    }
  } catch {
    /* static fallback below */
  }
  return COURSES.find((c) => c.id === key) ?? null;
}

/** Resolve a faculty member by ID (ACTIVE only, public fields). Email,
 * phone and user links never leave this function. Demo list (empty by
 * design) is the only fallback; unknown IDs are null (proper 404). */
export async function getPublicFacultyBySlug(slug: unknown): Promise<FacultyMember | null> {
  const key = cleanSlug(slug);
  if (!key) return null;
  try {
    const db: Db = getDb();
    if (db) {
      const row = await db.faculty.findFirst({
        where: { id: key, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          designation: true,
          subject: true,
          qualification: true,
          experience: true,
          bio: true,
          photo: true,
        },
      });
      if (row) return toFacultyMember(row);
    }
  } catch {
    /* static fallback below */
  }
  return FACULTY.find((f) => f.id === key) ?? null;
}

/** Published course catalogue for server pages (ACTIVE rows or static). */
export async function getPublicCourseList(): Promise<Course[]> {
  try {
    const db: Db = getDb();
    if (db) {
      const rows = await db.course.findMany({
        where: { status: "ACTIVE" },
        orderBy: { displayOrder: "asc" },
        take: 200,
      });
      if (Array.isArray(rows) && rows.length > 0) return rows.map(toCourse);
    }
  } catch {
    /* static fallback below */
  }
  return COURSES;
}

/** Published faculty directory for server pages (ACTIVE rows or static). */
export async function getPublicFacultyList(): Promise<FacultyMember[]> {
  try {
    const db: Db = getDb();
    if (db) {
      const rows = await db.faculty.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          designation: true,
          subject: true,
          qualification: true,
          experience: true,
          bio: true,
          photo: true,
        },
        take: 200,
      });
      if (Array.isArray(rows) && rows.length > 0) return rows.map(toFacultyMember);
    }
  } catch {
    /* static fallback below */
  }
  return FACULTY;
}
