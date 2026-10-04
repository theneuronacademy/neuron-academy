import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://neuronacademy.in";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { COURSES } = await import("@/data/courses");
  const { FACULTY } = await import("@/data/faculty");
  const staticRoutes = ["", "/student/login", "/faculty/login", "/admin/login"].map((r) => ({
    url: `${BASE}${r || "/"}`,
    lastModified: new Date(),
  }));
  const courseRoutes = COURSES.map((c) => ({ url: `${BASE}/courses/${c.id}`, lastModified: new Date() }));
  const facultyRoutes = FACULTY.map((f) => ({ url: `${BASE}/faculty/${f.id}`, lastModified: new Date() }));
  return [...staticRoutes, ...courseRoutes, ...facultyRoutes];
}
