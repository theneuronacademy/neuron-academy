// Public homepage CMS wiring regression checks.
// Run: npm run website:check
// No database, no network, no new packages. Exercises the REAL live-data
// helpers (services/siteApi) with stubbed fetch plus static assertions over
// public APIs and homepage sections. Exits non-zero on failure.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

let pass = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    pass += 1;
  } else {
    failed += 1;
    console.error("FAIL: " + name);
  }
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

async function main(): Promise<void> {
  // Stub browser fetch before importing the client-side service layer.
  // services/siteApi registers window listeners at module scope, so the stub
  // must provide no-op add/removeEventListener (was a bare {} before this
  // check ever ran — the harness threw "window.addEventListener is not a
  // function" at import time).
  (globalThis as Record<string, unknown>).window = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  let mode: "db" | "empty" | "down" | "throw" = "down";
  (globalThis as unknown as { fetch: unknown }).fetch = async (path: string) => {
    if (mode === "throw") throw new Error("offline");
    if (mode === "down") {
      return { ok: false, status: 503, json: async () => ({ success: false }) } as unknown as Response;
    }
    if (mode === "empty") {
      return { ok: true, status: 200, json: async () => ({ success: true, data: { items: [], source: "database" } }) } as unknown as Response;
    }
    const items =
      String(path).includes("/api/faculty")
        ? [{ id: "f-live", name: "Dr Live", designation: "Physics Mentor", subject: "Physics", qualification: "PhD", experience: "10 yrs", bio: "Live bio", photo: "" }]
        : String(path).includes("/api/gallery")
          ? [{ id: "g-live", title: "Live Photo", category: "Events", imageUrl: "https://cdn.test/g.jpg" }]
          : String(path).includes("/api/testimonials")
            ? [{ id: "t-live", name: "Live Student", role: "JEE", message: "Great academy", photo: "", rating: 5 }]
            : [{ id: "c-live", slug: "live", name: "Live Course", category: "Engineering", description: "Live desc", status: "ACTIVE" }];
    return { ok: true, status: 200, json: async () => ({ success: true, data: { items, source: "database" } }) } as unknown as Response;
  };

  const site = await import("../services/siteApi");

  // 1. live getters return null (never throw, never fake) without DB rows.
  mode = "down";
  check("live courses null when DB down", (await site.getLiveCourses()) === null);
  check("live faculty null when DB down", (await site.getLiveFaculty()) === null);
  check("live gallery null when DB down", (await site.getLiveGallery()) === null);
  check("live testimonials null when DB down", (await site.getLiveTestimonials()) === null);
  mode = "throw";
  check("live getters null on network failure", (await site.getLiveCourses()) === null && (await site.getLiveFaculty()) === null);
  mode = "empty";
  check("live getters null on empty tables (fallback keeps page filled)", (await site.getLiveGallery()) === null && (await site.getLiveTestimonials()) === null);

  // 2. public getters fall back to static data without a database.
  mode = "down";
  const [courses, faculty, gallery] = await Promise.all([site.getCourses(), site.getFaculty(), site.getGallery()]);
  check("courses fall back to static catalogue", Array.isArray(courses) && courses.length > 0);
  check("faculty falls back to static (possibly empty) list", Array.isArray(faculty));
  check("gallery falls back to static list", Array.isArray(gallery));

  // 3. live rows flow through with identical component shapes.
  mode = "db";
  const [lc, lf, lg, lt] = await Promise.all([site.getCourses(), site.getFaculty(), site.getGallery(), site.getTestimonials()]);
  check("live course maps to card shape", lc.some((c) => c.id === "live" && typeof c.name === "string" && typeof c.desc === "string"));
  check("live faculty maps to card shape", lf.some((f) => f.id === "f-live" && typeof f.intro === "string" && typeof f.profileUrl === "string"));
  check("live gallery maps to grid shape", lg.some((g) => g.id === "g-live" && typeof g.image === "string"));
  check("live testimonial maps to carousel shape", lt.some((t) => t.id === "t-live" && typeof t.testimonial === "string"));

  // 4. publication filtering: drafts/inactive never served publicly.
  const facultyApi = read("app/api/faculty/route.ts");
  check("faculty hides inactive profiles publicly", facultyApi.includes('{ status: "ACTIVE" }') && facultyApi.includes('viewer?.role === "ADMIN" ? {}'));
  const coursesApi = read("app/api/courses/route.ts");
  check("courses hide inactive publicly, all for ADMIN", coursesApi.includes('{ status: "ACTIVE" }') && coursesApi.includes("getUserFromRequest(req)"));
  const galleryApi = read("app/api/gallery/route.ts");
  check("gallery filters isActive for non-admin", galleryApi.includes("{ isActive: true }"));
  const testiApi = read("app/api/testimonials/route.ts");
  check("testimonials filter isActive for non-admin", testiApi.includes("{ isActive: true }"));
  const bannersApi = read("app/api/banners/route.ts");
  check("banners filter active window publicly", bannersApi.includes("isActive") && bannersApi.includes("ADMIN"));
  for (const [name, rel] of [["gallery", "app/api/gallery/route.ts"], ["testimonials", "app/api/testimonials/route.ts"], ["courses", "app/api/courses/route.ts"], ["faculty", "app/api/faculty/route.ts"]] as const) {
    const code = read(rel);
    check(`${name} writes stay ADMIN-only`, code.includes('requireApiRole(req, ["ADMIN"])'));
  }

  // 5. homepage consumes live data with static fallbacks intact.
  const home = read("app/page.tsx");
  check("homepage loads live CMS on mount", home.includes("getLiveCourses") && home.includes("getLiveFaculty") && home.includes("getLiveGallery") && home.includes("getLiveTestimonials"));
  check("homepage keeps static fallbacks where they exist", home.includes("liveFaculty ?? FACULTY") && home.includes("liveGallery ?? GALLERY"));
  check("homepage validates live rows before swapping", home.includes('typeof r.id === "string"'));
  check("gallery categories derive from loaded items", home.includes("new Set(items.map((g) => g.category)"));
  check("no helper-text leak in gallery UI", !home.includes("ADD gallery-"));
  check("faculty empty state retained", home.includes("No faculty profiles published yet."));
  const testi = read("components/website/Testimonials.tsx");
  check("testimonials accept live items", testi.includes("items = TESTIMONIALS") && testi.includes("items.length"));
}

async function checkDetailSlugs(): Promise<void> {
  // Runtime: server slug resolution works with no database (static fallback)
  // and stays honest for unknown slugs. getDb() is null without DATABASE_URL
  // or its queries throw against an unreachable host — both paths must fall
  // back identically, never throw, never leak.
  const server = await import("../services/siteServer");
  const demoCourse = await server.getPublicCourseBySlug("jee");
  check("demo course slug resolves without DB", demoCourse !== null && demoCourse.id === "jee" && typeof demoCourse.name === "string");
  check("unknown course slug is null (proper 404)", (await server.getPublicCourseBySlug("no-such-course-xyz")) === null);
  check("blank slugs are null", (await server.getPublicCourseBySlug("")) === null && (await server.getPublicCourseBySlug(undefined)) === null);
  check("unknown faculty slug is null (proper 404)", (await server.getPublicFacultyBySlug("no-such-faculty")) === null);
  const courseSlugs = await server.getPublishedCourseSlugs();
  check("course prerender slugs fall back to demo list", Array.isArray(courseSlugs) && courseSlugs.length > 0 && courseSlugs.every((s) => typeof s === "string"));
  const facultySlugs = await server.getPublishedFacultySlugs();
  check("faculty prerender slugs return an array", Array.isArray(facultySlugs));
  const [courseList, facultyList] = await Promise.all([server.getPublicCourseList(), server.getPublicFacultyList()]);
  check("server course/faculty lists fall back to arrays", Array.isArray(courseList) && Array.isArray(facultyList));

  // Static: live resolution is ACTIVE-only with public field selection.
  const srv = read("services/siteServer.ts");
  check("course lookup requires ACTIVE status", srv.includes("where: { slug: key, status: \"ACTIVE\" }"));
  check("faculty lookup requires ACTIVE status", srv.includes("where: { id: key, status: \"ACTIVE\" }"));
  check("faculty public select excludes PII", !/select:\s*\{[^}]*\b(email|phone|userId)\b/.test(srv) && srv.includes("photo: true"));
  check("server helpers never imported by client UI", !read("app/page.tsx").includes("siteServer") && !read("components/website/Testimonials.tsx").includes("siteServer"));

  // Static: detail pages resolve live slugs, keep 404s and resolved metadata.
  // (Faculty detail routes on /faculty/[id]; the resolver helpers keep the
  // slug named API — assertion paths corrected to the actual route files.)
  for (const [name, rel, slugArg] of [["courses", "app/courses/[slug]/page.tsx", "getPublicCourseBySlug(slug)"], ["faculty", "app/faculty/[id]/page.tsx", "getPublicFacultyBySlug(id)"]] as const) {
    const code = read(rel);
    check(`${name} page has no "use client" (server resolution)`, !code.includes('"use client"'));
    check(`${name} prerender uses published slugs`, code.includes("getPublished") && code.includes("generateStaticParams"));
    check(`${name} metadata uses the resolved record`, code.includes("generateMetadata") && code.includes("getPublic"));
    check(`${name} unknown slugs 404`, code.includes("notFound()"));
    check(`${name} page resolves via live slug lookup`, code.includes(slugArg));
  }
}

main()
  .then(() => checkDetailSlugs())
  .then(() => checkShowcase())
  .then(() => {
    console.log(`website-check: ${pass} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  })
  .catch((err) => {
    console.error("website-check threw", err instanceof Error ? err.message : err);
    process.exit(1);
  });

async function checkShowcase(): Promise<void> {
  const { showcaseValidation, activationAllowed } = await import("../lib/showcase");

  // Runtime: validation + consent gate (pure logic, no DB).
  check("valid showcase passes", showcaseValidation({ studentName: "Ayan Khan", achievement: "AIR 42", exam: "JEE Advanced", score: "99.2 %ile", year: "2026", imageUrl: "https://cdn.test/a.jpg" }) === null);
  check("missing name/achievement rejected", showcaseValidation({ studentName: "", achievement: "" }) !== null);
  check("oversize fields rejected", showcaseValidation({ studentName: "x".repeat(81), achievement: "AIR 1" }) !== null);
  check("bad year rejected", showcaseValidation({ studentName: "Asha", achievement: "AIR 1", year: "99" }) !== null);
  check("non-http image rejected", showcaseValidation({ studentName: "Asha", achievement: "AIR 1", imageUrl: "javascript:alert(1)" }) !== null);
  check("publish needs consent", activationAllowed(false, true) === false);
  check("draft without consent allowed", activationAllowed(false, false) === true);
  check("consented publish allowed", activationAllowed(true, true) === true);

  // Static: public endpoint serves consented + active only; writes ADMIN-only.
  const route = read("app/api/showcase/route.ts");
  check("public list requires consent + active", route.includes("{ isActive: true, consent: true }"));
  check("ADMIN sees all showcase rows", route.includes('viewer?.role === "ADMIN" ? {}'));
  check("showcase writes ADMIN-only", (route.match(/requireApiRole\(req, \["ADMIN"\]\)/g) ?? []).length >= 1);
  check("showcase stores no PII fields", !route.includes("phone") && !route.includes("email") && !route.includes("studentId"));
  const detail = read("app/api/showcase/[id]/route.ts");
  check("showcase update/delete ADMIN-only", detail.includes('requireApiRole(req, ["ADMIN"])'));
  check("showcase update re-validates consent gate", detail.includes("activationAllowed"));
  const schemaBlock = read("prisma/schema.prisma");
  check("ResultShowcase model holds no PII columns", !/model ResultShowcase \{[^}]*\b(phone|email|passwordHash)\b/.test(schemaBlock));
  check(
    // The CREATE TABLE lives in the active baseline now (superseded the old
    // 2026-10-10 per-feature migration, which was folded into the baseline).
    "showcase table comes from the active schema baseline",
    read("prisma/migrations/20261021120000_current_schema_baseline/migration.sql").includes('CREATE TABLE "ResultShowcase"')
  );
  check(
    "showcase description migration is additive (nullable column)",
    read("prisma/migrations/20261025120000_showcase_description_testimonial_achievement/migration.sql").includes('ALTER TABLE "ResultShowcase" ADD COLUMN "description" TEXT;')
  );

  // Static: admin page manages showcase (not offline marks) with consent UI.
  const admin = read("app/admin/website/results/page.tsx");
  check("admin page uses showcase API", admin.includes("/api/showcase") && !admin.includes("/api/results/offline"));
  check("admin form captures consent + publish", admin.includes("Consent confirmed") && admin.includes("Publish immediately"));

  // Static: homepage wall prefers published rows, keeps honest empty state.
  const home = read("app/page.tsx");
  check("wall loads live showcase", home.includes("getLiveShowcase"));
  check("wall badge only on static fallback", home.includes("wallLive ? null : (") && home.includes("DEMO — VERIFY BEFORE PUBLISH"));
  check("wall keeps empty state", home.includes("No results published yet."));
}
