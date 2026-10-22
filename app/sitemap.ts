import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://neuronacademy.in";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const { COURSES } = await import("@/data/courses");

  // Prefer live database slugs when a database is configured; fall back to
  // static data so `next build` never requires DATABASE_URL.
  let courseSlugs: string[] = COURSES.map((c) => c.id);
  if (process.env.DATABASE_URL) {
    try {
      const { getDb } = await import("@/lib/prisma");
      const db = getDb();
      if (db) {
        const dbCourses = await (db as unknown as { course: { findMany: (a: unknown) => Promise<{ slug: string }[]> } }).course
          .findMany({ select: { slug: true } })
          .catch(() => []);
        if (dbCourses.length > 0) courseSlugs = dbCourses.map((c) => c.slug);
      }
    } catch {
      /* build-safe: static fallback above */
    }
  }

  return [
    { url: `${BASE}/`, lastModified: now },
    { url: `${BASE}/courses`, lastModified: now },
    ...courseSlugs.map((s) => ({ url: `${BASE}/courses/${s}`, lastModified: now })),
    { url: `${BASE}/scholarship-tests`, lastModified: now },
    { url: `${BASE}/admin/login`, lastModified: now },
  ];
}
