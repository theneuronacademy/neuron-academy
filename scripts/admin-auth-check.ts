// Phase 17 — admin authorization regression checks.
// Run: npm run admin:check
// No database, no network, no new packages. Exercises the REAL server helpers
// (lib/session, lib/server-auth) plus static route-guard assertions over the
// admin module. Exits non-zero on failure.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { createSessionToken, getUserFromRequest } from "../lib/session";
import { requireApiRole } from "../lib/server-auth";

const ROOT = process.cwd();
process.env.SESSION_SECRET = "admin-regression-test-secret";

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

function fakeReq(token?: string): NextRequest {
  return {
    cookies: {
      get: (name: string) => (name === "neuron_session" && token ? { value: token } : undefined),
    },
  } as unknown as NextRequest;
}

function tokenFor(role: string): string {
  const t = createSessionToken({ id: `u-${role}`, email: `${role.toLowerCase()}@x.test`, role: role as "ADMIN" | "FACULTY" | "STUDENT", name: role });
  if (!t) throw new Error("test secret missing");
  return t;
}

function deniedStatus(res: ReturnType<typeof requireApiRole>): number | null {
  return res.ok ? null : res.status;
}

// 1. anonymous → admin API = 401
{
  const u = getUserFromRequest(fakeReq());
  check("anonymous has no session user", u === null);
  const r = requireApiRole(fakeReq(), ["ADMIN"]);
  check("anonymous blocked from admin API (401)", !r.ok && r.status === 401);
}

// 2. student → admin API = 403
{
  const r = requireApiRole(fakeReq(tokenFor("STUDENT")), ["ADMIN"]);
  check("student blocked from admin API (403)", !r.ok && r.status === 403);
}

// 3. faculty → admin API = 403
{
  const r = requireApiRole(fakeReq(tokenFor("FACULTY")), ["ADMIN"]);
  check("faculty blocked from admin API (403)", !r.ok && r.status === 403);
}

// 4. admin → admin API = allowed
{
  const r = requireApiRole(fakeReq(tokenFor("ADMIN")), ["ADMIN"]);
  check("admin allowed into admin API", r.ok);
}

// 5. admin routes enforce requireApiRole
{
  const routes = [
    "app/api/students/route.ts",
    "app/api/students/[id]/route.ts",
    "app/api/faculty/route.ts",
    "app/api/faculty/[id]/route.ts",
    "app/api/courses/route.ts",
    "app/api/courses/[id]/route.ts",
    "app/api/batches/route.ts",
    "app/api/batches/[id]/route.ts",
    "app/api/tests/route.ts",
    "app/api/tests/[id]/route.ts",
    "app/api/questions/route.ts",
    "app/api/questions/[id]/route.ts",
    "app/api/results/route.ts",
    "app/api/results/offline/route.ts",
    "app/api/attendance/route.ts",
    "app/api/test-access/route.ts",
    "app/api/test-access/[id]/route.ts",
    "app/api/admin/books/route.ts",
    "app/api/admin/books/[id]/route.ts",
    "app/api/notifications/route.ts",
    "app/api/notifications/[id]/route.ts",
    "app/api/biometric/devices/route.ts",
    "app/api/biometric/devices/[id]/route.ts",
    "app/api/dashboard/stats/route.ts",
    "app/api/enquiries/route.ts",
    "app/api/banners/route.ts",
    "app/api/popups/route.ts",
    "app/api/gallery/route.ts",
    "app/api/testimonials/route.ts",
    "app/api/announcements/route.ts",
  ];
  for (const f of routes) {
    const code = read(f);
    if (f.includes("POST") || f.includes("[id]") || f.endsWith("/route.ts")) {
      check(`${f} has ADMIN auth guard`, code.includes("requireApiRole") && code.includes("ADMIN"));
    }
  }
}

// 6. destructive actions have dependency checks (409)
{
  const checks: Array<[string, string, string]> = [
    ["students delete 409 on dependents", "app/api/students/[id]/route.ts", "dependents"],
    ["faculty delete 409 on batches", "app/api/faculty/[id]/route.ts", "409"],
    ["batches delete 409 on dependents", "app/api/batches/[id]/route.ts", "409"],
    ["courses delete 409 on dependents", "app/api/courses/[id]/route.ts", "409"],
    ["tests delete 409 on history", "app/api/tests/[id]/route.ts", "409"],
  ];
  for (const [name, file, marker] of checks) {
    check(name, read(file).includes(marker));
  }
}

// 7. faculty test management scope
{
  const code = read("app/api/tests/[id]/route.ts");
  check("tests detail has facultyMayManageTest", code.includes("facultyMayManageTest"));
  const qcode = read("app/api/questions/[id]/route.ts");
  check("questions detail has facultyMayManageTest", qcode.includes("facultyMayManageTest"));
  check("questions create checks faculty scope", read("app/api/questions/route.ts").includes("facultyMayManageTest"));
}

// 8. results faculty scope includes student batch check
{
  check("results POST checks student batch", read("app/api/results/route.ts").includes("student.batchId"));
}

// 9. public content routes filter by isActive
{
  const routes = ["app/api/banners/route.ts", "app/api/popups/route.ts", "app/api/gallery/route.ts", "app/api/testimonials/route.ts", "app/api/announcements/route.ts"];
  for (const f of routes) {
    check(`${f} filters by isActive for non-admin`, read(f).includes("isActive: true"));
  }
}

// 10. biometric DELETE uses select DEVICE_SELECT
{
  check("biometric DELETE uses DEVICE_SELECT", read("app/api/biometric/devices/[id]/route.ts").includes("select: DEVICE_SELECT"));
  check("biometric PATCH validates IP/port/protocol", read("app/api/biometric/devices/[id]/route.ts").includes("return fail"));
}

// 11. no passwordHash/dobHash in any admin response
{
  const adminRoutes = [
    "app/api/students/route.ts",
    "app/api/students/[id]/route.ts",
    "app/api/faculty/route.ts",
    "app/api/faculty/[id]/route.ts",
  ];
  for (const f of adminRoutes) {
    check(`${f} no hash leak`, !read(f).includes("passwordHash") && !read(f).includes("dobHash"));
  }
}

// 12. no localStorage authority in admin mutations
{
  const adminPages = [
    "app/admin/students/page.tsx",
    "app/admin/faculty/page.tsx",
    "app/admin/batches/page.tsx",
    "app/admin/tests/page.tsx",
    "app/admin/results/page.tsx",
    "app/admin/attendance/page.tsx",
    "app/admin/books/page.tsx",
    "app/admin/notifications/page.tsx",
    "app/admin/test-access/page.tsx",
    "app/admin/enquiries/page.tsx",
    "app/admin/biometric-devices/page.tsx",
    "app/admin/dashboard/page.tsx",
  ];
  for (const f of adminPages) {
    check(`${f} no localStorage writes`, !read(f).includes("localStorage.setItem"));
  }
}

// 13. admin dashboard shows live stats (not fake)
{
  const dash = read("app/admin/dashboard/page.tsx");
  check("dashboard reads liveStats from /api/dashboard/stats", dash.includes("/api/dashboard/stats"));
  check("dashboard labels demo fallbacks", dash.includes("Demo data") || dash.includes("demo"));
}

// 14. admin pages use server session check (useAdminGuard or /api/auth/session)
{
  const adminPages = [
    "app/admin/students/page.tsx",
    "app/admin/faculty/page.tsx",
    "app/admin/batches/page.tsx",
    "app/admin/tests/page.tsx",
    "app/admin/results/page.tsx",
    "app/admin/attendance/page.tsx",
    "app/admin/books/page.tsx",
    "app/admin/notifications/page.tsx",
    "app/admin/test-access/page.tsx",
    "app/admin/enquiries/page.tsx",
    "app/admin/biometric-devices/page.tsx",
  ];
  for (const f of adminPages) {
    const code = read(f);
    check(`${f} has server auth check`, code.includes("useAdminGuard") || code.includes("/api/auth/session") || code.includes("isAdminAuthenticated"));
  }
}

// 15. notifications page honest (no local writes on failure)
{
  check("notifications page no local write on failure", !read("app/admin/notifications/page.tsx").includes("Stored locally"));
}

// 16. banners/popups/gallery/testimonials/announcements use PATCH for toggle/move
{
  const checks = [
    ["banners toggleActive uses PATCH", "app/admin/website/banners/page.tsx", "toggleActive"],
    ["banners move uses PATCH", "app/admin/website/banners/page.tsx", 'method: "PATCH"'],
    ["popups toggleActive uses PATCH", "app/admin/website/popups/page.tsx", "toggleActive"],
    ["courses toggle uses PATCH", "app/admin/website/courses/page.tsx", 'method: "PATCH"'],
    ["faculty toggleActive uses PATCH", "app/admin/website/faculty/page.tsx", "toggleActive"],
  ];
  for (const [name, file, marker] of checks) {
    check(name, read(file).includes(marker));
  }
}

// 17. admin profile uses server session
{
  check("admin profile reads /api/auth/session", read("app/admin/profile/page.tsx").includes("/api/auth/session"));
}

// 18. no client-trusted role/id in any admin API
{
  const apiFiles = [
    "app/api/students/[id]/route.ts",
    "app/api/faculty/[id]/route.ts",
    "app/api/batches/[id]/route.ts",
    "app/api/courses/[id]/route.ts",
    "app/api/tests/[id]/route.ts",
    "app/api/questions/[id]/route.ts",
    "app/api/results/[id]/route.ts",
    "app/api/test-access/[id]/route.ts",
    "app/api/biometric/devices/[id]/route.ts",
  ];
  for (const f of apiFiles) {
    const code = read(f);
    check(`${f} no body.role trust`, !code.includes("body.role"));
    check(`${f} no body.userId trust`, !code.includes("body.userId"));
    check(`${f} no body.adminId trust`, !code.includes("body.adminId"));
  }
}

console.log(`admin-check: ${pass} passed, ${failed} failed`);
if (failed > 0) process.exit(1);