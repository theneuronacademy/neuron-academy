import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://neuronacademy.in";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const { COURSES } = await import("@/data/courses");
  const { FACULTY } = await import("@/data/faculty");

  // Prefer live database slugs when a database is configured; fall back to
  // static data so `next build` never requires DATABASE_URL.
  let courseSlugs: string[] = COURSES.map((c) => c.id);
  let facultySlugs: string[] = FACULTY.map((f) => f.id);
  if (process.env.DATABASE_URL) {
    try {
      const { getDb } = await import("@/lib/prisma");
      const db = getDb();
      if (db) {
        const [dbCourses, dbFaculty] = await Promise.all([
          (db as unknown as { course: { findMany: (a: unknown) => Promise<{ slug: string }[]> } }).course
            .findMany({ select: { slug: true } })
            .catch(() => []),
          (db as unknown as { faculty: { findMany: (a: unknown) => Promise<{ slug: string }[]> } }).faculty
            .findMany({ select: { slug: true } })
            .catch(() => []),
        ]);
        if (dbCourses.length > 0) courseSlugs = dbCourses.map((c) => c.slug);
        if (dbFaculty.length > 0) facultySlugs = dbFaculty.map((f) => f.slug);
      }
    } catch {
      /* build-safe: static fallback above */
    }
  }

  return [
    { url: `${BASE}/`, lastModified: now },
    { url: `${BASE}/courses`, lastModified: now },
    ...courseSlugs.map((s) => ({ url: `${BASE}/courses/${s}`, lastModified: now })),
    { url: `${BASE}/faculty`, lastModified: now },
    ...facultySlugs.map((s) => ({ url: `${BASE}/faculty/${s}`, lastModified: now })),
    { url: `${BASE}/scholarship-tests`, lastModified: now },
    { url: `${BASE}/student/login`, lastModified: now },
    { url: `${BASE}/faculty/login`, lastModified: now },
    { url: `${BASE}/admin/login`, lastModified: now },
  ];
}
