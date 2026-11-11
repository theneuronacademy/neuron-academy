import type { MetadataRoute } from "next";

import { SITE_URL as BASE } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const { COURSES } = await import("@/data/courses");
  const { TOPICS } = await import("@/data/topics");
  const { EXAM_PAGES } = await import("@/data/exams");

  // Prefer live database slugs when a database is configured; fall back to
  // static data so `next build` never requires DATABASE_URL.
  let courseSlugs: string[] = COURSES.map((c) => c.id);
  let facultyIds: string[] = [];
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
    try {
      const { getPublishedFacultySlugs } = await import("@/services/siteServer");
      facultyIds = (await getPublishedFacultySlugs()).filter(Boolean);
    } catch {
      /* build-safe: empty list */
    }
  }

  return [
    { url: `${BASE}/`, lastModified: now },
    ...courseSlugs.map((s) => ({ url: `${BASE}/courses/${s}`, lastModified: now })),
    { url: `${BASE}/scholarship-tests`, lastModified: now },
    { url: `${BASE}/faculty`, lastModified: now },
    ...facultyIds.map((id) => ({ url: `${BASE}/faculty/${id}`, lastModified: now })),
    ...EXAM_PAGES.map((e) => ({ url: `${BASE}/coaching/${e.slug}`, lastModified: now })),
    ...TOPICS.map((t) => ({ url: `${BASE}/topics/${t.slug}`, lastModified: now })),
  ];
}
