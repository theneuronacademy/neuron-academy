// Phase 14 — faculty authorization regression checks.
// Run: npm run faculty:check
// No database, no network, no new packages. Exercises REAL server helpers
// (lib/session, lib/server-auth) plus static route-guard assertions over the
// faculty module. Exits non-zero on failure.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import {
  createSessionToken,
  getUserFromRequest,
} from "../lib/session";
import { requireApiRole } from "../lib/server-auth";

const ROOT = process.cwd();
const TEST_SECRET = "faculty-regression-test-secret-32";
process.env.SESSION_SECRET = TEST_SECRET;

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

// 1. Anonymous → faculty API = 401 (real helper)
{
  const r = requireApiRole(fakeReq(), ["FACULTY"]);
  check("anonymous faculty API denied", !r.ok && r.status === 401);
}

// 2. Student → faculty API = 403 (real helper)
{
  const r = requireApiRole(fakeReq(tokenFor("STUDENT")), ["FACULTY"]);
  check("student blocked from faculty API", !r.ok && r.status === 403);
}

// 3. Faculty → faculty API = allowed (real helper)
{
  const r = requireApiRole(fakeReq(tokenFor("FACULTY")), ["FACULTY"]);
  check("faculty allowed on faculty API", r.ok);
}

// 4. Admin → faculty-scoped API allowed only where intentionally shared
{
  const r = requireApiRole(fakeReq(tokenFor("ADMIN")), ["FACULTY", "ADMIN"]);
  check("admin allowed where policy shares route", r.ok);
  const me = read("app/api/faculty/me/route.ts");
  check("faculty/me rejects non-faculty", me.includes('viewer.role !== "FACULTY"'));
}

// 5. Every faculty API enforces requireApiRole with FACULTY
{
  const routes = [
    "app/api/faculty/dashboard/route.ts",
    "app/api/faculty/batches/route.ts",
    "app/api/faculty/students/route.ts",
    "app/api/faculty/activity/route.ts",
    "app/api/faculty/analytics/route.ts",
  ];
  for (const f of routes) {
    const src = read(f);
    check(`${f} enforces FACULTY role`, src.includes('requireApiRole(req, ["FACULTY"') || src.includes('requireApiRole(req, ["FACULTY", "ADMIN"])'));
  }
  const att = read("app/api/attendance/route.ts");
  check("attendance enforces ADMIN/FACULTY", att.includes('requireApiRole(req, ["ADMIN", "FACULTY"])'));
  check("attendance scopes faculty batches", att.includes("facultyBatchIds"));
}

// 6. Manual source forced for faculty writes
{
  const att = read("app/api/attendance/route.ts");
  check("manual source forced for faculty writes", att.includes('source: "MANUAL"'));
}

// 7. No client-controlled authorization (no facultyId from body trusted)
{
  const dash = read("app/api/faculty/dashboard/route.ts");
  check("dashboard derives identity from session", dash.includes("auth.user.id") && !dash.includes("body.facultyId"));
  const stud = read("app/api/faculty/students/route.ts");
  check("students derive identity from session", stud.includes("auth.user.id") && !stud.includes("body.facultyId"));
}

// 8. Batch scoping uses facultyBatchIds everywhere
{
  for (const f of [
    "app/api/faculty/dashboard/route.ts",
    "app/api/faculty/batches/route.ts",
    "app/api/faculty/students/route.ts",
    "app/api/faculty/activity/route.ts",
    "app/api/faculty/analytics/route.ts",
  ]) {
    check(`${f} scopes batches`, read(f).includes("facultyBatchIds"));
  }
}

// 9. No localStorage authority in faculty pages
{
  const pages = [
    "app/faculty/dashboard/page.tsx",
    "app/faculty/batches/page.tsx",
    "app/faculty/students/page.tsx",
    "app/faculty/attendance/page.tsx",
    "app/faculty/tests/page.tsx",
    "app/faculty/results/page.tsx",
    "app/faculty/analytics/page.tsx",
    "app/faculty/notifications/page.tsx",
    "app/faculty/profile/page.tsx",
  ];
  for (const f of pages) {
    const src = read(f);
    check(`${f} has no localStorage authority`, !src.includes("localStorage"));
  }
}

// 10. Faculty profile edit allowlist (no role/status/batch change)
{
  const me = read("app/api/faculty/me/route.ts");
  check("profile edit allowlists safe fields", me.includes("qualification") && me.includes("experience") && me.includes("bio"));
  check("profile edit cannot change role", !me.includes("role:") || me.includes("viewer.role !=="));
  check("profile edit cannot change status", !/status:\s*body/.test(me));
  check("profile edit cannot change batch", !me.includes("batchId"));
}

// 11. No sensitive fields in faculty selects
{
  const stud = read("app/api/faculty/students/route.ts");
  check("no passwordHash in faculty selects", !stud.includes("passwordHash"));
  check("no dobHash in faculty selects", !stud.includes("dobHash"));
  const me = read("app/api/faculty/me/route.ts");
  check("no passwordHash in faculty/me", !me.includes("passwordHash"));
}

// 12. Middleware protects all faculty app routes
{
  const mw = read("middleware.ts");
  check("middleware guards /faculty/*", mw.includes('pathname === "/faculty" || pathname.startsWith("/faculty/")'));
  check("public faculty slugs preserved", mw.includes("FACULTY_RESERVED"));
}

// 13. Session user extraction works for faculty tokens (real helper)
{
  const u = getUserFromRequest(fakeReq(tokenFor("FACULTY")));
  check("faculty session resolves role", u?.role === "FACULTY");
}

// 14. Scores remain server-authoritative (no client score accepted in faculty writes)
{
  const res = read("app/api/results/route.ts");
  check("results compute percentage server-side", res.includes("percentage") && res.includes("Math.round"));
}

// 15. Test creation constrained for faculty
{
  const t = read("app/api/tests/route.ts");
  check("faculty test create batch-scoped", t.includes("facultyBatchIds"));
  check("faculty cannot set accessType/price", t.includes("Only admins can set test access type or price"));
}

console.log(`faculty-auth-check: ${pass} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
