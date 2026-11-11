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
import type { AcademyResult } from "@/data/results";
import { getDb } from "@/lib/prisma";
import { presentFaculty } from "@/lib/displayText";

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
    target: String(row.target ?? ""),
    duration: String(row.duration ?? "1 year"),
    mode: String(row.mode ?? "Offline + Online"),
    faculty: String(row.facultyName ?? ""),
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
  return presentFaculty({
    id: String(row.id),
    name: String(row.name),
    designation: String(row.designation ?? "Faculty"),
    subject: String(row.subject ?? "General"),
    qualification: String(row.qualification ?? ""),
    experience: String(row.experience ?? ""),
    intro: String(row.bio ?? row.qualification ?? ""),
    image: String(row.photo ?? ""),
    profileUrl: "#faculty",
  });
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

/**
 * Active, in-window banners for the home page's first render, with each
 * image's natural size so the browser can reserve its space. Returns null
 * when the database is unavailable — the page then loads banners in the
 * browser exactly as before.
 */
export async function getPublicBannerRows(): Promise<Record<string, unknown>[] | null> {
  try {
    const db: Db = getDb();
    if (!db) return null;
    const now = new Date();
    const rows = await db.banner.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, take: 20 });
    const visible = (rows as Record<string, unknown>[]).filter((b) => {
      const start = b.startDate as Date | null | undefined;
      const end = b.endDate as Date | null | undefined;
      return (start == null || start <= now) && (end == null || end >= now);
    });
    return await Promise.all(
      visible.map(async (b) => {
        const row: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(b)) row[k] = v instanceof Date ? v.toISOString() : v;
        const size = typeof b.imageUrl === "string" ? await cloudinaryImageSize(b.imageUrl) : null;
        if (size) {
          row.mediaWidth = size.width;
          row.mediaHeight = size.height;
        }
        return row;
      }),
    );
  } catch {
    return null;
  }
}

/** Natural pixel size of a Cloudinary image (fl_getinfo); null if it cannot be read quickly. */
async function cloudinaryImageSize(url: string): Promise<{ width: number; height: number } | null> {
  const marker = "/image/upload/";
  if (!url.includes("res.cloudinary.com") || !url.includes(marker)) return null;
  try {
    const res = await fetch(url.replace(marker, `${marker}fl_getinfo/`), { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const info = (await res.json()) as { input?: { width?: number; height?: number } };
    const width = info.input?.width;
    const height = info.input?.height;
    return typeof width === "number" && typeof height === "number" && width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  }
}

/**
 * Courses, faculty and published results for the home page's first render,
 * so they are present in the HTML search engines read. Each list is null
 * when the database is unavailable or empty — the page then loads that list
 * in the browser exactly as before. Queries and ordering mirror the public
 * API routes the browser uses, so the refresh after load changes nothing.
 */
export async function getHomeInitialData(): Promise<{ courses: Course[] | null; faculty: FacultyMember[] | null; wall: AcademyResult[] | null }> {
  const empty = { courses: null, faculty: null, wall: null };
  let db: Db;
  try {
    db = getDb();
  } catch {
    return empty;
  }
  if (!db) return empty;

  const safe = async <T>(run: () => Promise<T[]>): Promise<T[] | null> => {
    try {
      const rows = await run();
      return Array.isArray(rows) && rows.length > 0 ? rows : null;
    } catch {
      return null;
    }
  };

  const [courseRows, facultyRows, wallRows] = await Promise.all([
    safe(() => db.course.findMany({ where: { status: "ACTIVE" }, orderBy: { displayOrder: "asc" }, take: 200 })),
    safe(() =>
      db.faculty.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, designation: true, subject: true, qualification: true, experience: true, bio: true, photo: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ),
    // Only rows with confirmed consent that the academy has published.
    safe(() => db.resultShowcase.findMany({ where: { isActive: true, consent: true }, orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }], take: 200 })),
  ]);

  const palette = ["#1746B8", "#D4AF37", "#102B70", "#7C8BA3"];
  return {
    courses: courseRows ? (courseRows as Parameters<typeof toCourse>[0][]).map(toCourse) : null,
    faculty: facultyRows ? (facultyRows as Parameters<typeof toFacultyMember>[0][]).map(toFacultyMember) : null,
    wall: wallRows
      ? (wallRows as Record<string, unknown>[]).map((r, i) => ({
          id: String(r.id),
          name: String(r.studentName),
          score: String(r.score ?? r.achievement ?? ""),
          tag: String(r.achievement ?? ""),
          exam: String(r.exam ?? ""),
          year: String(r.year ?? ""),
          description: String(r.description ?? ""),
          image: String(r.imageUrl ?? ""),
          color: palette[i % palette.length],
        }))
      : null,
  };
}
