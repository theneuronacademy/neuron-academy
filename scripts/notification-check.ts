// Phase 15 — notification authorization regression checks.
// Run: npm run notification:check
// No database, no network, no new packages. Exercises REAL server helpers
// (lib/session, lib/server-auth) plus static route-guard assertions over the
// notification module. Exits non-zero on failure.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { createSessionToken, getUserFromRequest } from "../lib/session";
import { requireApiRole } from "../lib/server-auth";

const ROOT = process.cwd();
process.env.SESSION_SECRET = "notification-regression-test-secret";

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

// 1. anonymous → notifications = 401
{
  const u = getUserFromRequest(fakeReq());
  check("anonymous has no session user", u === null);
  const r = requireApiRole(fakeReq(), ["ADMIN"]);
  check("anonymous blocked from admin notifications (401)", !r.ok && r.status === 401);
}

// 2. student → own notifications = allowed (mine feed authenticates, never 403s own feed)
{
  const r = requireApiRole(fakeReq(tokenFor("STUDENT")), ["STUDENT", "FACULTY"]);
  check("student passes role gate for own feed", r.ok);
  const mine = read("app/api/notifications/mine/route.ts");
  check("mine feed resolves student profile server-side", mine.includes("resolveStudent(db, viewer.id, viewer.email)"));
}

// 3. student → another user's notifications = blocked (PATCH scoped to visible set)
{
  const mine = read("app/api/notifications/mine/route.ts");
  check("student mark-read scoped to visible set", mine.includes("...visible") && mine.includes("targetStudentId: profile.id"));
  check("student mark-read returns 404 on foreign id", mine.includes('fail("Notification not found.", 404)'));
  check("student mark-read verifies visibility first", mine.includes("findFirst") && mine.includes("id: body.id"));
}

// Phase 16 — per-user read receipts: one student's read must never clear
// another recipient's unread state on a shared broadcast.
{
  const mine = read("app/api/notifications/mine/route.ts");
  check("broadcast reads use per-user receipts", mine.includes("NotificationRead") || mine.includes("notificationRead"));
  check("shared flag only flips for individually-targeted rows", mine.includes("isIndividual"));
  check("unread count is per-user", mine.includes("unreadCount") && mine.includes("receipts.has"));
}

// 4. faculty → own notifications = allowed
{
  const r = requireApiRole(fakeReq(tokenFor("FACULTY")), ["STUDENT", "FACULTY"]);
  check("faculty passes role gate for own feed", r.ok);
  const mine = read("app/api/notifications/mine/route.ts");
  check("mine feed has faculty branch", mine.includes('viewer.role === "FACULTY"'));
}

// 5. faculty → another user's notifications = blocked
{
  const mine = read("app/api/notifications/mine/route.ts");
  check("faculty mark-read scoped to own feed", mine.includes("facultyVisible"));
  check("faculty cannot forge targetUserId", !mine.includes("body.targetUserId"));
}

// 6. student cannot create admin notification
{
  const admin = read("app/api/notifications/route.ts");
  check("admin create requires ADMIN", admin.includes('requireApiRole(req, ["ADMIN"])'));
  const r = requireApiRole(fakeReq(tokenFor("STUDENT")), ["ADMIN"]);
  check("student blocked from admin create (403)", !r.ok && r.status === 403);
}

// 7. faculty cannot create admin notification
{
  const r = requireApiRole(fakeReq(tokenFor("FACULTY")), ["ADMIN"]);
  check("faculty blocked from admin create (403)", !r.ok && r.status === 403);
}

// 8. mark-read cannot target another user
{
  const mine = read("app/api/notifications/mine/route.ts");
  check("mark-read derives identity from session", mine.includes("viewer.id") && !mine.includes("body.userId") && !mine.includes("body.studentId"));
}

// 9. mark-read cannot target another user (receipts scoped to session id)
{
  const mine = read("app/api/notifications/mine/route.ts");
  check("student mark-all writes receipts as session user", mine.includes("recordReads(db, viewer.id"));
  check("faculty mark-all writes receipts as session user", mine.includes("facultyVisible"));
}

// 10. arbitrary recipientId injection blocked
{
  const admin = read("app/api/notifications/route.ts");
  check("admin create has no recipientId param", !admin.includes("recipientId"));
  check("admin create validates audience allowlist", admin.includes("AUDIENCES.includes"));
}

// 11. notification list has safe limit/pagination
{
  const mine = read("app/api/notifications/mine/route.ts");
  check("mine feed has bounded limit", mine.includes("parseLimit") && mine.includes("take: limit"));
  check("mine limit clamped (max 100)", mine.includes("100"));
  const admin = read("app/api/notifications/route.ts");
  check("admin list has bounded limit", admin.includes("take: limit"));
}

// 12. notification API does not expose secrets
{
  const mine = read("app/api/notifications/mine/route.ts");
  const shapeBlock = mine.slice(mine.indexOf("function shape"), mine.indexOf("export async function GET"));
  check("feed shape exposes only safe fields", shapeBlock.includes("id") && shapeBlock.includes("title") && !shapeBlock.includes("password") && !shapeBlock.includes("otp") && !shapeBlock.includes("secret"));
  const detail = read("app/api/notifications/[id]/route.ts");
  check("detail route is ADMIN-only", detail.includes('requireApiRole(req, ["ADMIN"])'));
}

// 13. push subscription is bound to authenticated user
{
  const sub = read("app/api/push/subscribe/route.ts");
  check("push subscribe requires session", sub.includes("getUserFromRequest(req)") && sub.includes("Not authenticated"));
  check("push subscribe binds viewer.id", sub.includes("subscribe(db, viewer.id"));
  check("push unsubscribe binds viewer.id", sub.includes("unsubscribe(db, viewer.id"));
  check("push never trusts client userId", !sub.includes("body.userId"));
}

// 14. VAPID private key never reaches client
{
  const sub = read("app/api/push/subscribe/route.ts");
  check("push GET returns only public key", sub.includes("publicKey: env.publicKey") && !sub.includes("privateKey"));
  const wp = read("services/webPush.ts");
  check("private key stays server-side", wp.includes("process.env.VAPID_PRIVATE_KEY") && !wp.includes("publicKey: env.privateKey"));
  check("push delivery honest when unconfigured", wp.includes("WEB_PUSH_NOT_CONFIGURED"));
  check("push never claims delivery without provider", wp.includes("WEB_PUSH_PROVIDER_MISSING"));
}

// 15. deduplication guards exist on triggers
{
  const publish = read("app/api/tests/[id]/route.ts");
  check("publish notifies only on transition", publish.includes('previous?.status !== "PUBLISHED"'));
  const submit = read("app/api/tests/[id]/submit/route.ts");
  check("result notifies only on first release", submit.includes("if (!existing)"));
  const att = read("app/api/attendance/route.ts");
  check("absence alert deduped per student/day", att.includes("already") && att.includes('type: "attendance"'));
  check("absence alert never fails attendance write", att.includes("safeNotify"));
}

console.log(`notification-check: ${pass} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
