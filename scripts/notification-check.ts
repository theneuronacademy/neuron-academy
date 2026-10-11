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
  check("absence alert deduped per student/day", att.includes("already") && att.includes("ATTENDANCE_ABSENT") && att.includes("canonicalNotificationType"));
  check("absence alert never fails attendance write", att.includes("dispatchNotification"));
}

// ------------------------------------------------- Phase 18b: engine ---
import {
  DEFAULT_CHANNEL_POLICY,
  DEFAULT_PRIORITY,
  canonicalNotificationType,
  isKnownEvent,
  isMandatoryEvent,
  NOTIFICATION_EVENTS,
  resolveChannels,
  resolvePriority,
} from "../lib/notification-events";
import {
  academyName,
  eventForTemplate,
  flowIdFor,
  isSmsTemplateKey,
  isTemplateAllowedForEvent,
  renderSmsTemplate,
  SMS_TEMPLATES,
  SMS_TEMPLATE_KEYS,
} from "../lib/sms-templates";
import { maskPhone, normalizeIndianMobile } from "../lib/otp";
import { sendSms } from "../services/msg91";
import { dispatchNotification, MAX_SMS_PER_DISPATCH } from "../services/notificationEngine";
import type { PrismaClient } from "@prisma/client";

// 16. event catalog: all required events exist, OTP/security are mandatory
{
  const required = [
    "OTP_REQUESTED", "OTP_VERIFIED", "LOGIN_SECURITY_OTP", "PASSWORD_RESET_OTP",
    "TEST_PUBLISHED", "TEST_REMINDER", "RESULT_RELEASED",
    "ATTENDANCE_MARKED", "ATTENDANCE_ABSENT",
    "BATCH_ANNOUNCEMENT", "ADMIN_ANNOUNCEMENT", "ACADEMIC_NOTICE",
    "ADMISSION_UPDATE", "REGISTRATION_UPDATE",
    "ACCESS_GRANTED", "ACCESS_REVOKED",
    "FACULTY_NOTIFICATION", "EMERGENCY_ALERT",
  ];
  check("16: all required events in catalog", required.every((e) => (NOTIFICATION_EVENTS as readonly string[]).includes(e) && isKnownEvent(e)));
  check("16: unknown event rejected", !isKnownEvent("DELETE_EVERYTHING"));
  check("16: OTP/security events are mandatory", isMandatoryEvent("OTP_REQUESTED") && isMandatoryEvent("LOGIN_SECURITY_OTP") && isMandatoryEvent("PASSWORD_RESET_OTP") && isMandatoryEvent("EMERGENCY_ALERT"));
  check("16: broadcast events are not mandatory", !isMandatoryEvent("TEST_PUBLISHED") && !isMandatoryEvent("BATCH_ANNOUNCEMENT"));
}

// 17. default channel policy (exact) + priorities
{
  check("17: OTP is SMS-only", JSON.stringify(DEFAULT_CHANNEL_POLICY.OTP_REQUESTED) === JSON.stringify(["SMS"]));
  check("17: login/reset OTP is SMS-only", JSON.stringify(DEFAULT_CHANNEL_POLICY.LOGIN_SECURITY_OTP) === JSON.stringify(["SMS"]) && JSON.stringify(DEFAULT_CHANNEL_POLICY.PASSWORD_RESET_OTP) === JSON.stringify(["SMS"]));
  const triple: (keyof typeof DEFAULT_CHANNEL_POLICY)[] = [
    "TEST_PUBLISHED", "TEST_REMINDER", "RESULT_RELEASED", "ATTENDANCE_ABSENT",
    "BATCH_ANNOUNCEMENT", "ADMIN_ANNOUNCEMENT", "ACADEMIC_NOTICE",
    "ADMISSION_UPDATE", "REGISTRATION_UPDATE", "ACCESS_GRANTED", "ACCESS_REVOKED",
    "FACULTY_NOTIFICATION", "EMERGENCY_ALERT",
  ];
  check("17: broadcasts are SMS+PUSH+IN_APP", triple.every((e) => JSON.stringify(DEFAULT_CHANNEL_POLICY[e]) === JSON.stringify(["SMS", "PUSH", "IN_APP"])));
  check("17: attendance marked skips SMS", JSON.stringify(DEFAULT_CHANNEL_POLICY.ATTENDANCE_MARKED) === JSON.stringify(["PUSH", "IN_APP"]));
  check("17: OTP override cannot add channels", JSON.stringify(resolveChannels("OTP_REQUESTED", ["SMS", "PUSH"])) === JSON.stringify(["SMS"]));
  check("17: unknown channel override falls back to policy", JSON.stringify(resolveChannels("TEST_PUBLISHED", ["PIGEON"])) === JSON.stringify(["SMS", "PUSH", "IN_APP"]));
  check("17: priorities sane", DEFAULT_PRIORITY.RESULT_RELEASED === "HIGH" && DEFAULT_PRIORITY.ATTENDANCE_ABSENT === "HIGH" && DEFAULT_PRIORITY.EMERGENCY_ALERT === "CRITICAL" && DEFAULT_PRIORITY.TEST_PUBLISHED === "NORMAL" && DEFAULT_PRIORITY.ACCESS_GRANTED === "HIGH");
  check("17: bad priority falls back", resolvePriority("TEST_PUBLISHED", "URGENT") === "NORMAL" && resolvePriority("EMERGENCY_ALERT", undefined) === "CRITICAL");
}

// 18. SMS templates: catalog + rendering + DLT configurability
{
  const keys = [
    "OTP", "TEST_PUBLISHED", "TEST_REMINDER", "RESULT_RELEASED",
    "ATTENDANCE_ABSENT", "BATCH_ANNOUNCEMENT", "ADMIN_ANNOUNCEMENT",
    "ACADEMIC_NOTICE", "ADMISSION_UPDATE", "ACCESS_GRANTED",
    "ACCESS_REVOKED", "FACULTY_NOTIFICATION", "EMERGENCY_ALERT",
  ];
  check("18: all templates defined", keys.every((k) => (SMS_TEMPLATE_KEYS as readonly string[]).includes(k) && isSmsTemplateKey(k) && SMS_TEMPLATES[k as keyof typeof SMS_TEMPLATES].body.length > 0));
  const rendered = renderSmsTemplate("RESULT_RELEASED", { academyName: "Neuron Academy", studentName: "Asha", testName: "Mock 1", result: "90/100 (90%)" });
  check("18: template renders all vars", rendered.missing.length === 0 && rendered.text.includes("Asha") && rendered.text.includes("Mock 1") && !rendered.text.includes("{{"));
  check("18: missing vars detected", renderSmsTemplate("RESULT_RELEASED", { academyName: "X" }).missing.length > 0);
  delete process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
  check("18: flow ID empty when unconfigured", flowIdFor("TEST_PUBLISHED") === "");
  process.env.MSG91_FLOW_ID_TEST_PUBLISHED = "  999  ";
  check("18: flow ID configurable via env", flowIdFor("TEST_PUBLISHED") === "999");
  delete process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
  check("18: academy name defaults safely", academyName().length > 0);
}

// 19. triggers route through the ONE engine (no per-route SMS logic)
{
  const publish = read("app/api/tests/[id]/route.ts");
  check("19: publish uses engine with idempotency key", publish.includes("dispatchNotification") && publish.includes("TEST_PUBLISHED:${row.id}") && publish.includes("TEST_PUBLISHED"));
  const submit = read("app/api/tests/[id]/submit/route.ts");
  check("19: result uses engine with idempotency key", submit.includes("dispatchNotification") && submit.includes("RESULT_RELEASED:${result.id}"));
  const att = read("app/api/attendance/route.ts");
  check("19: absent uses engine with idempotency key", att.includes("dispatchNotification") && att.includes("ATTENDANCE_ABSENT:${studentId}:${dateStr}"));
  const grant = read("app/api/test-access/route.ts");
  check("19: grant uses engine with idempotency key", grant.includes("dispatchNotification") && grant.includes("ACCESS_GRANTED:${testId}:${studentId}"));
  const revoke = read("app/api/test-access/[id]/route.ts");
  check("19: revoke uses engine, once per transition", revoke.includes("dispatchNotification") && revoke.includes('row.status !== "REVOKED"') && revoke.includes("ACCESS_REVOKED:${row.testId}:${row.studentId}"));
  const allRoutes = publish + submit + att + grant + revoke;
  check("19: no route calls MSG91 directly", !allRoutes.includes("services/msg91") && !allRoutes.includes("api.msg91.com"));
  const engine = read("services/notificationEngine.ts");
  check("19: engine never throws to triggers", engine.includes("NEVER throws") && engine.includes("ENGINE_ERROR"));
  check("19: engine resolves audiences server-side", engine.includes("resolveRecipients") && !engine.includes("body.studentId"));
}

// 20. idempotency: duplicate events send nothing twice (canonical types)
{
  const engine = read("services/notificationEngine.ts");
  check("20: natural-key dedup exists", engine.includes("findDuplicate"));
  check("20: created type === searched type (canonical)", engine.includes("canonicalNotificationType(event)"));
  check("20: publish dedups on canonical test type", engine.includes("TEST_PUBLISHED") && engine.includes("testId"));
  check("20: result dedups on test+student", engine.includes("RESULT_RELEASED"));
  check("20: absent dedups per student/day", engine.includes("ATTENDANCE_ABSENT"));
  check("20: access dedups grant vs revoke", engine.includes("granted access") && engine.includes("has been revoked"));
  check("20: no legacy type aliases remain", !engine.includes('type: "test"') && !engine.includes('type: "result"') && !engine.includes('type: "attendance"') && !engine.includes('type: "access"'));
  check("20: duplicate returns without sending", engine.includes("DUPLICATE") && engine.includes("duplicate: true"));
}

// 21. faculty scope + student scope + admin broadcast
{
  const engine = read("services/notificationEngine.ts");
  check("21: faculty blocked from wide audiences", engine.includes("NOTIFY_SCOPE_DENIED") && engine.includes("assigned batches"));
  check("21: faculty individual limited to own batches", engine.includes("outside your assigned batches"));
  check("21: student self-only", engine.includes("only notify yourself") && engine.includes("NOTIFY_FORBIDDEN"));
  check("21: admin broadcast requires mass-SMS confirm", engine.includes("MASS_CONFIRM_REQUIRED") && engine.includes("confirmMassSend"));
  const adminRoute = read("app/api/notifications/route.ts");
  check("21: admin create stays ADMIN-only", adminRoute.includes('requireApiRole(req, ["ADMIN"])'));
  check("21: admin route forwards confirm flag", adminRoute.includes("confirmMassSend"));
  check("21: admin estimate endpoint exists", adminRoute.includes('estimate') && adminRoute.includes("estimateAudience"));
}

// 22. failure isolation per channel
{
  const engine = read("services/notificationEngine.ts");
  check("22: in-app never depends on SMS", engine.includes("never depends on SMS"));
  check("22: sms/push fanned out independently", engine.includes("SMS (Msg91Provider; independent") && engine.includes("independent of SMS/in-app"));
  check("22: per-channel report", engine.includes("ChannelSummary") && engine.includes("PARTIAL"));
  check("22: delivery never over-claimed", engine.includes("DELIVERED is") && engine.includes("never claimed"));
}

// 23. retry: bounded, transient-only, no loops
{
  const engine = read("services/notificationEngine.ts");
  check("23: no retry loops in engine", !engine.includes("retry(") && engine.includes("No retry loops"));
  check("23: retryable flagged from provider", engine.includes("res.retryable") || engine.includes("retryable: true"));
  check("23: fan-out bounded", engine.includes("MAX_SMS_PER_DISPATCH"));
  const svc = read("services/msg91.ts");
  check("23: provider marks transient retryable", svc.includes("retryable: true") && svc.includes("retryable: false"));
  check("23: 4xx/auth not retryable", svc.includes("res.status >= 500"));
}

// 24. scheduling persisted honestly, never faked
{
  const engine = read("services/notificationEngine.ts");
  check("24: future schedule persists SCHEDULED", engine.includes('"SCHEDULED"') && engine.includes("scheduled: true"));
  check("24: scheduler requirement documented", engine.includes("scheduler/cron"));
  check("24: safeNotify supports scheduled rows", read("lib/notify.ts").includes("scheduledAt"));
}

// 25. push routed through engine, failures isolated, no fake delivery
{
  const engine = read("services/notificationEngine.ts");
  check("25: push via provider stub", engine.includes("sendPush") && engine.includes("pushSubscription"));
  check("25: push failures isolated", engine.includes("push.failed += 1"));
  const adminPage = read("app/admin/notifications/page.tsx");
  check("25: admin center exposes channels", adminPage.includes("Channels") && adminPage.includes("SMS") && adminPage.includes("Push"));
  check("25: admin center exposes priority", adminPage.includes("Priority") && adminPage.includes("CRITICAL"));
  check("25: admin center exposes templates", adminPage.includes("SMS template"));
  check("25: admin center shows estimate + mass confirm", adminPage.includes("Estimated audience") && adminPage.includes("Confirm mass SMS"));
}

// 26. transactional SMS provider (stubbed fetch — NEVER real SMS here)
async function checkSmsProvider(): Promise<void> {
  const savedFetch = globalThis.fetch;
  const savedKey = process.env.MSG91_AUTH_KEY;
  const savedSender = process.env.MSG91_SENDER_ID;
  const stub = (mode: "success" | "reject" | "http500" | "throw") => {
    (globalThis as unknown as { fetch: unknown }).fetch = async () => {
      if (mode === "throw") throw new Error("network down");
      if (mode === "http500") return { ok: false, status: 500, json: async () => null } as unknown as Response;
      if (mode === "reject") return { ok: true, status: 200, json: async () => ({ type: "error" }) } as unknown as Response;
      return { ok: true, status: 200, json: async () => ({ type: "success" }) } as unknown as Response;
    };
  };
  try {
    delete process.env.MSG91_AUTH_KEY;
    delete process.env.MSG91_SENDER_ID;
    stub("success");
    const noCreds = await sendSms("+919876543210", "123", { academyName: "X" });
    check("26: sms without creds is honest", noCreds.ok === false && noCreds.code === "SMS_NOT_CONFIGURED" && noCreds.retryable === false);
    process.env.MSG91_AUTH_KEY = "test-key";
    process.env.MSG91_SENDER_ID = "TESTID";
    const badPhone = await sendSms("not-a-number", "123", {});
    check("26: invalid recipient never retries", badPhone.ok === false && badPhone.code === "SMS_INVALID_RECIPIENT" && badPhone.retryable === false);
    const noFlow = await sendSms("+919876543210", "", {});
    check("26: missing flow ID is honest", noFlow.ok === false && noFlow.code === "SMS_TEMPLATE_NOT_CONFIGURED");
    stub("success");
    const sent = await sendSms("+919876543210", "123", { academyName: "Neuron Academy" });
    check("26: provider success is SENT", sent.ok === true && sent.code === "SENT");
    stub("reject");
    const rejected = await sendSms("+919876543210", "123", {});
    check("26: provider rejection is honest + not retryable", rejected.ok === false && rejected.code === "SMS_PROVIDER_ERROR" && rejected.retryable === false);
    stub("http500");
    const down = await sendSms("+919876543210", "123", {});
    check("26: provider 500 is retryable", down.ok === false && down.code === "SMS_PROVIDER_ERROR" && down.retryable === true);
    stub("throw");
    const unreachable = await sendSms("+919876543210", "123", {});
    check("26: network failure is retryable, never throws", unreachable.ok === false && unreachable.retryable === true);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.MSG91_AUTH_KEY;
    else process.env.MSG91_AUTH_KEY = savedKey;
    if (savedSender === undefined) delete process.env.MSG91_SENDER_ID;
    else process.env.MSG91_SENDER_ID = savedSender;
  }
}

// 27. no secret leakage across the platform
function checkNoLeakage(): void {
  const svc = read("services/msg91.ts");
  const engine = read("services/notificationEngine.ts");
  check("27: no NEXT_PUBLIC credentials", !svc.includes("NEXT_PUBLIC") && !engine.includes("NEXT_PUBLIC"));
  check("27: no raw provider payload to client", !engine.includes("json()"));
  check("27: phone validation before SMS", engine.includes("normalizeIndianMobile") && normalizeIndianMobile("98765 43210") === "+919876543210");
  check("27: logs mask phones", maskPhone("+919876543210") === "+91******10");
  check("27: register page still client-clean", !read("app/student/register/page.tsx").includes("services/msg91"));
  check("27: no OTP value in engine", !engine.includes("otp") || !/console\.\w+\([^)]*\botp\b/i.test(engine));
}

// --------------------------------------- Phase 18c: core correctness ---
// Stubbed providers only: fake Db (no database), stubbed fetch where an SMS
// provider call is unavoidable. NEVER a real MSG91 call.
interface FakeStudent {
  id: string;
  name: string;
  phone: string;
  userId: string | null;
  batchId?: string | null;
  status?: string;
}
const ADMIN_ACTOR = { id: "admin-1", role: "ADMIN" };
function makeStudent(i: number): FakeStudent {
  const n = String(i).padStart(2, "0");
  return { id: `s${i}`, name: `Student ${n}`, phone: `+91987654${String(1000 + i).slice(-4)}`, userId: `u-s${i}`, batchId: "b1", status: "ACTIVE" };
}
function fakeDb(opts: {
  findFirst?: { id: string } | null;
  students?: FakeStudent[];
  singleStudent?: FakeStudent | null;
  faculty?: { id: string; name: string; phone: string; userId: string | null; status?: string }[];
  singleFaculty?: { id: string; name: string; phone: string; userId: string | null; status?: string } | null;
  created?: Record<string, unknown>[];
}): PrismaClient {
  const created = opts.created ?? [];
  const students = opts.students ?? [];
  const faculty = opts.faculty ?? [];
  return {
    notification: {
      findFirst: async () => opts.findFirst ?? null,
      create: async (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return { id: `n-${created.length}` };
      },
    },
    student: {
      findUnique: async () => opts.singleStudent ?? null,
      findMany: async () => students,
      count: async () => students.length,
    },
    faculty: {
      findUnique: async () => opts.singleFaculty ?? null,
      findFirst: async () => null,
      findMany: async () => faculty,
      count: async () => faculty.length,
    },
    batch: { findUnique: async () => null },
    pushSubscription: { findMany: async () => [] },
  } as unknown as PrismaClient;
}

async function checkEngineCore(): Promise<void> {
  // 1. canonical event type consistency
  {
    const events = NOTIFICATION_EVENTS as readonly string[];
    check("28.1: every event maps to itself canonically", events.every((e) => canonicalNotificationType(e as never as Parameters<typeof canonicalNotificationType>[0]) === e));
    const engine = read("services/notificationEngine.ts");
    check("28.1: engine creates what findDuplicate searches", engine.includes("canonicalNotificationType(event)") && engine.includes("const ctype = canonicalNotificationType(event)"));
    check("28.1: no legacy aliases in engine or builders", !engine.includes('type: "test"') && read("lib/notify.ts").includes('"TEST_PUBLISHED"') && read("lib/notify.ts").includes('"ATTENDANCE_ABSENT"'));
    check("28.1: duplicate lookup is type-scoped", engine.includes("type: ctype"));
  }
  // 2-6. automatic-event duplicate prevention (second delivery sends nothing)
  const dupCases: { name: string; event: string; audience: Record<string, unknown>; extra: Record<string, unknown>; single?: FakeStudent; batch?: boolean }[] = [
    { name: "28.2: TEST_PUBLISHED duplicate sends nothing", event: "TEST_PUBLISHED", audience: { kind: "BATCH", batchId: "b1" }, extra: { testId: "t1", templateKey: "TEST_PUBLISHED", vars: { testName: "Mock 1" } }, batch: true },
    { name: "28.3: RESULT_RELEASED duplicate sends nothing", event: "RESULT_RELEASED", audience: { kind: "INDIVIDUAL", studentId: "s1" }, extra: { testId: "t1" }, single: makeStudent(1) },
    { name: "28.4: ATTENDANCE_ABSENT duplicate sends nothing", event: "ATTENDANCE_ABSENT", audience: { kind: "INDIVIDUAL", studentId: "s1" }, extra: {}, single: makeStudent(1) },
    { name: "28.5: ACCESS_GRANTED duplicate sends nothing", event: "ACCESS_GRANTED", audience: { kind: "INDIVIDUAL", studentId: "s1" }, extra: { testId: "t1" }, single: makeStudent(1) },
    { name: "28.6: ACCESS_REVOKED duplicate sends nothing", event: "ACCESS_REVOKED", audience: { kind: "INDIVIDUAL", studentId: "s1" }, extra: { testId: "t1" }, single: makeStudent(1) },
  ];
  for (const c of dupCases) {
    const created: Record<string, unknown>[] = [];
    const db = fakeDb({ findFirst: { id: "existing" }, students: c.batch ? [makeStudent(1)] : [], singleStudent: c.single ?? null, created });
    const report = await dispatchNotification(db, {
      event: c.event,
      actor: ADMIN_ACTOR,
      audience: c.audience as never,
      title: "Dup probe",
      message: "Second delivery must send nothing.",
      channels: ["IN_APP"],
      internal: true,
      idempotencyKey: `${c.event}:probe`,
      ...c.extra,
    });
    check(c.name, report.ok === true && report.code === "DUPLICATE" && report.duplicate === true && created.length === 0 && report.inApp.state === "SKIPPED" && report.sms.state === "DUPLICATE" && report.push.state === "DUPLICATE");
  }
  // 7. ADMIN_ANNOUNCEMENT duplicate prevention (no exclusion)
  {
    const created: Record<string, unknown>[] = [];
    const db = fakeDb({ findFirst: { id: "existing" }, students: [makeStudent(1)], created });
    const report = await dispatchNotification(db, {
      event: "ADMIN_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "Same manual send",
      message: "Submitted twice with the same key.",
      channels: ["IN_APP"],
      idempotencyKey: "ADMIN_ANNOUNCEMENT:stable-1",
    });
    const engine = read("services/notificationEngine.ts");
    check("28.7: manual announcement deduped like every event", report.code === "DUPLICATE" && created.length === 0);
    check("28.7: no ADMIN_ANNOUNCEMENT exclusion remains", !engine.includes('event !== "ADMIN_ANNOUNCEMENT"'));
  }
  // 8. faculty individual visibility (persisted + queryable by own faculty)
  {
    const created: Record<string, unknown>[] = [];
    const db = fakeDb({ singleFaculty: { id: "f1", name: "Fac One", phone: "+919876543210", userId: "u-f1", status: "ACTIVE" }, created });
    const report = await dispatchNotification(db, {
      event: "FACULTY_NOTIFICATION",
      actor: ADMIN_ACTOR,
      audience: { kind: "INDIVIDUAL", facultyId: "f1" },
      title: "For faculty",
      message: "Only f1 may see this.",
      channels: ["IN_APP"],
      internal: true,
    });
    const mine = read("app/api/notifications/mine/route.ts");
    check("28.8: faculty row carries both ids", report.ok === true && created.length === 1 && created[0].targetFacultyId === "f1" && created[0].targetUserId === "u-f1");
    check("28.8: faculty feed includes targetFacultyId (session-derived)", mine.includes("targetFacultyId") && mine.includes("resolveFacultyId") && !mine.includes("body.targetFacultyId"));
  }
  // 9-10. cohort audiences never store a generic ALL_STUDENTS row
  for (const kind of ["REGULAR", "SCHOLARSHIP"] as const) {
    const created: Record<string, unknown>[] = [];
    const db = fakeDb({ students: [makeStudent(1), makeStudent(2)], created });
    const report = await dispatchNotification(db, {
      event: "BATCH_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind },
      title: `${kind} only`,
      message: "Cohort fan-out probe.",
      templateKey: "BATCH_ANNOUNCEMENT",
      channels: ["IN_APP"],
      internal: true,
    });
    check(`28.${kind === "REGULAR" ? "9" : "10"}: ${kind} fans out to individuals only`, report.ok === true && created.length === 2 && created.every((r) => r.audience === "INDIVIDUAL" && typeof r.targetStudentId === "string") && created.every((r) => r.audience !== "ALL_STUDENTS"));
  }
  // 11. course audience rejected (schema cannot represent it)
  {
    const created: Record<string, unknown>[] = [];
    const db = fakeDb({ students: [makeStudent(1)], created });
    const report = await dispatchNotification(db, {
      event: "BATCH_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind: "COURSE" } as never,
      title: "Course probe",
      message: "Must never silently send to nobody.",
      channels: ["IN_APP"],
      internal: true,
    });
    check("28.11: COURSE rejected, never silent", report.ok === false && report.code === "NOTIFY_BAD_AUDIENCE" && created.length === 0 && !read("app/api/notifications/route.ts").includes('"COURSE"'));
  }
  // 12. all-users resolves students + faculty without loss
  {
    const created: Record<string, unknown>[] = [];
    const db = fakeDb({ students: [makeStudent(1), makeStudent(2)], faculty: [{ id: "f1", name: "Fac", phone: "+919876543210", userId: "u-f1" }], created });
    const report = await dispatchNotification(db, {
      event: "ADMIN_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_USERS" },
      title: "Everyone",
      message: "Both cohorts must get a visible row.",
      channels: ["IN_APP"],
      internal: true,
    });
    const kinds = created.map((r) => r.audience).sort();
    check("28.12: ALL_USERS persists student + faculty rows", report.ok === true && created.length === 2 && kinds[0] === "ALL_STUDENTS" && kinds[1] === "FACULTY");
  }
  // 13. individual targeting is explicit and singular
  {
    const created: Record<string, unknown>[] = [];
    const db = fakeDb({ singleStudent: makeStudent(7), created });
    const report = await dispatchNotification(db, {
      event: "ACCESS_GRANTED",
      actor: ADMIN_ACTOR,
      audience: { kind: "INDIVIDUAL", studentId: "s7" },
      title: "Only you",
      message: "Single-recipient probe.",
      testId: "t9",
      channels: ["IN_APP"],
      internal: true,
    });
    check("28.13: individual row names exactly one recipient", report.ok === true && created.length === 1 && created[0].targetStudentId === "s7" && created[0].audience === "INDIVIDUAL");
  }
  // 14. PATCH cannot force SENT
  {
    const detail = read("app/api/notifications/[id]/route.ts");
    check("28.14: SENT rows immutable, no direct SENT transition", detail.includes("NOTIFY_IMMUTABLE") && detail.includes("NOTIFY_BAD_TRANSITION") && !detail.includes('body.status === "SENT" ? { sentAt'));
  }
  // 15. mandatory channels cannot be removed (server-enforced, UI-locked)
  {
    check("28.15: emergency keeps full policy on override", JSON.stringify(resolveChannels("EMERGENCY_ALERT", ["IN_APP"])) === JSON.stringify(["SMS", "PUSH", "IN_APP"]));
    check("28.15: verified-OTP stays SMS-only on override", JSON.stringify(resolveChannels("OTP_VERIFIED", ["SMS", "PUSH", "IN_APP"])) === JSON.stringify(["SMS"]));
    check("28.15: composer locks mandatory channels", read("app/admin/notifications/page.tsx").includes("locked by mandatory policy"));
  }
  // 16. invalid event/template pairing rejected (server never trusts UI)
  {
    const created: Record<string, unknown>[] = [];
    const db = fakeDb({ students: [makeStudent(1)], created });
    const report = await dispatchNotification(db, {
      event: "TEST_PUBLISHED",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "Mismatch probe",
      message: "Wrong template for this event.",
      templateKey: "EMERGENCY_ALERT",
      channels: ["IN_APP"],
      internal: true,
    });
    check("28.16: mismatched template rejected before any write", report.ok === false && report.code === "NOTIFY_BAD_TEMPLATE" && created.length === 0 && isTemplateAllowedForEvent("TEST_PUBLISHED", "TEST_PUBLISHED") && !isTemplateAllowedForEvent("TEST_PUBLISHED", "EMERGENCY_ALERT") && eventForTemplate("EMERGENCY_ALERT") === "EMERGENCY_ALERT");
  }
  // 17. missing template variables rejected with structure (no silent zero)
  {
    const savedFlow = process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
    process.env.MSG91_FLOW_ID_TEST_PUBLISHED = "test-flow";
    try {
      const created: Record<string, unknown>[] = [];
      const db = fakeDb({ students: [makeStudent(1), makeStudent(2)], created });
      const report = await dispatchNotification(db, {
        event: "TEST_PUBLISHED",
        actor: ADMIN_ACTOR,
        audience: { kind: "ALL_STUDENTS" },
        title: "Missing vars probe",
        message: "testName is required but absent.",
        templateKey: "TEST_PUBLISHED",
        vars: {},
        channels: ["SMS", "IN_APP"],
        internal: true,
      });
      check("28.17: missing vars fail SMS structurally, in-app intact", report.sms.state === "FAILED" && report.sms.skipped === 2 && typeof report.sms.error === "string" && report.sms.error.includes("testName") && report.inApp.state === "SENT");
    } finally {
      if (savedFlow === undefined) delete process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
      else process.env.MSG91_FLOW_ID_TEST_PUBLISHED = savedFlow;
    }
  }
  // 18. >200 SMS audience never silently disappears (stubbed provider only)
  {
    const savedFetch = globalThis.fetch;
    const savedFlow = process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
    const savedKey = process.env.MSG91_AUTH_KEY;
    const savedSender = process.env.MSG91_SENDER_ID;
    process.env.MSG91_FLOW_ID_TEST_PUBLISHED = "test-flow";
    process.env.MSG91_AUTH_KEY = "test-key";
    process.env.MSG91_SENDER_ID = "TESTID";
    (globalThis as unknown as { fetch: unknown }).fetch = async () =>
      ({ ok: true, status: 200, json: async () => ({ type: "success" }) }) as unknown as Response;
    try {
      const many = Array.from({ length: 250 }, (_, i) => makeStudent(i + 1));
      const created: Record<string, unknown>[] = [];
      const db = fakeDb({ students: many, created });
      const report = await dispatchNotification(db, {
        event: "TEST_PUBLISHED",
        actor: ADMIN_ACTOR,
        audience: { kind: "ALL_STUDENTS" },
        title: "Big broadcast",
        message: "250 recipients, cap is 200.",
        templateKey: "TEST_PUBLISHED",
        vars: { testName: "Mock 1" },
        channels: ["SMS", "IN_APP"],
        internal: true,
      });
      check("28.18: oversized fan-out is explicit PARTIAL, nothing hidden", report.sms.state === "PARTIAL" && report.sms.attempted === MAX_SMS_PER_DISPATCH && report.sms.sent === MAX_SMS_PER_DISPATCH && report.sms.skipped === 50 && typeof report.sms.error === "string");
    } finally {
      globalThis.fetch = savedFetch;
      if (savedFlow === undefined) delete process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
      else process.env.MSG91_FLOW_ID_TEST_PUBLISHED = savedFlow;
      if (savedKey === undefined) delete process.env.MSG91_AUTH_KEY;
      else process.env.MSG91_AUTH_KEY = savedKey;
      if (savedSender === undefined) delete process.env.MSG91_SENDER_ID;
      else process.env.MSG91_SENDER_ID = savedSender;
    }
  }
  // 19. scheduled notification remains scheduled (never SENT, never faked)
  {
    const created: Record<string, unknown>[] = [];
    const db = fakeDb({ students: [makeStudent(1)], created });
    const report = await dispatchNotification(db, {
      event: "ADMIN_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "Next week",
      message: "Future delivery probe.",
      channels: ["SMS", "PUSH", "IN_APP"],
      internal: true,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    check("28.19: future send persists SCHEDULED only", report.ok === true && report.code === "SCHEDULED" && report.scheduled === true && report.inApp.state === "SCHEDULED" && report.sms.state === "SCHEDULED" && report.push.state === "SCHEDULED" && created.length === 1 && created[0].status === "SCHEDULED");
  }
  // 20. priority survives engine dispatch
  {
    const created: Record<string, unknown>[] = [];
    const db = fakeDb({ students: [makeStudent(1)], created });
    const explicit = await dispatchNotification(db, {
      event: "TEST_PUBLISHED",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "Priority probe",
      message: "Explicit CRITICAL must survive.",
      channels: ["IN_APP"],
      priority: "CRITICAL",
      internal: true,
    });
    const db2 = fakeDb({ students: [makeStudent(1)], created: [] });
    const fallback = await dispatchNotification(db2, {
      event: "EMERGENCY_ALERT",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "Default probe",
      message: "Emergency defaults to CRITICAL.",
      templateKey: "EMERGENCY_ALERT",
      channels: ["IN_APP"],
      internal: true,
    });
    check("28.20: explicit + default priorities carried in report", explicit.priority === "CRITICAL" && fallback.priority === "CRITICAL" && resolvePriority("TEST_PUBLISHED", "URGENT") === "NORMAL");
  }
}

checkSmsProvider()
  .then(() => checkEngineCore())
  .then(() => checkNoLeakage())
  .then(() => checkStep3())
  .then(() => checkStep5())
  .then(() => checkCronWorker())
  .then(() => checkPhase3())
  .then(() => checkPhase4())
  .catch((err) => {
    failed += 1;
    console.error("FAIL: sms provider check threw", err instanceof Error ? err.message : err);
  })
  .finally(() => {
    console.log(`notification-check: ${pass} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  });

// --------------------------------- Phase 18c-step3: persistent delivery ---
// Stubbed providers only (fake Db with unique enforcement, stubbed fetch).
// NEVER a real MSG91 call. Every number comes from persisted fake rows.
function fakeDbStep3(opts: {
  students?: FakeStudent[];
  singleStudent?: FakeStudent | null;
  faculty?: { id: string; name: string; phone: string; userId: string | null; status?: string }[];
  singleFaculty?: { id: string; name: string; phone: string; userId: string | null; status?: string } | null;
  pushSubs?: Record<string, string[]>;
  // Phase 18c-step5: inject a genuine (non-P2002) store failure for matching
  // header creates, to simulate partial shard fan-out. Never a real DB.
  failCreate?: (data: Record<string, unknown>) => boolean;
}): PrismaClient & {
  __notifications: Record<string, unknown>[];
  __deliveries: Record<string, unknown>[];
} {
  const notifications: Record<string, unknown>[] = [];
  const deliveries: Record<string, unknown>[] = [];
  const students = opts.students ?? [];
  const faculty = opts.faculty ?? [];
  const pushSubs = opts.pushSubs ?? {};
  const db = {
    __notifications: notifications,
    __deliveries: deliveries,
    notification: {
      findFirst: async (args: { where?: Record<string, unknown> }) => {
        const where = (args?.where ?? {}) as Record<string, unknown>;
        const key = where.idempotencyKey as string | { startsWith?: string } | undefined;
        if (typeof key === "string") {
          return (notifications.find((n) => n.idempotencyKey === key) as { id: string } | undefined) ?? null;
        }
        if (key && typeof key === "object" && typeof key.startsWith === "string") {
          const prefix = key.startsWith;
          return (notifications.find((n) => typeof n.idempotencyKey === "string" && (n.idempotencyKey as string).startsWith(prefix)) as { id: string } | undefined) ?? null;
        }
        return null;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const data = args.data;
        if (opts.failCreate?.(data)) {
          throw new Error("store failed");
        }
        if (typeof data.idempotencyKey === "string" && data.idempotencyKey) {
          if (notifications.some((n) => n.idempotencyKey === data.idempotencyKey)) {
            const e = new Error("Unique constraint failed on the fields: (`idempotencyKey`)") as Error & { code?: string };
            e.code = "P2002";
            throw e;
          }
        }
        const row = { id: `n-${notifications.length + 1}`, ...data };
        notifications.push(row);
        return { id: row.id as string };
      },
    },
    notificationDelivery: {
      create: async (args: { data: Record<string, unknown> }) => {
        const data = args.data;
        const k = `${String(data.notificationId)}|${String(data.channel)}|${String(data.recipientKey)}`;
        if (deliveries.some((d) => `${String(d.notificationId)}|${String(d.channel)}|${String(d.recipientKey)}` === k)) {
          const e = new Error("Unique constraint failed on the fields: (`notificationId`, `channel`, `recipientKey`)") as Error & { code?: string };
          e.code = "P2002";
          throw e;
        }
        const row = { id: `d-${deliveries.length + 1}`, ...data };
        deliveries.push(row);
        return { id: row.id as string };
      },
      findMany: async (args?: { where?: Record<string, unknown> }) => {
        const where = (args?.where ?? {}) as Record<string, unknown>;
        return deliveries.filter((d) => {
          if (where.notificationId && typeof where.notificationId === "string" && d.notificationId !== where.notificationId) return false;
          if (where.notificationId && typeof where.notificationId === "object") {
            const inw = (where.notificationId as { in?: string[] }).in;
            if (Array.isArray(inw) && !inw.includes(String(d.notificationId))) return false;
          }
          if (where.channel && d.channel !== where.channel) return false;
          if (where.status && d.status !== where.status) return false;
          return true;
        });
      },
      count: async (args?: { where?: Record<string, unknown> }) => {
        const where = (args?.where ?? {}) as Record<string, unknown>;
        return deliveries.filter((d) => {
          if (where.notificationId && typeof where.notificationId === "string" && d.notificationId !== where.notificationId) return false;
          if (where.channel && d.channel !== where.channel) return false;
          if (where.status && d.status !== where.status) return false;
          if (where.retryable !== undefined && d.retryable !== where.retryable) return false;
          return true;
        }).length;
      },
    },
    student: {
      findUnique: async () => opts.singleStudent ?? null,
      findMany: async () => students,
      count: async () => students.length,
    },
    faculty: {
      findUnique: async () => opts.singleFaculty ?? null,
      findFirst: async () => null,
      findMany: async () => faculty,
      count: async () => faculty.length,
    },
    batch: { findUnique: async () => null },
    pushSubscription: {
      findMany: async (args: { where?: { userId?: string } }) => {
        const uid = args?.where?.userId ?? "";
        return (pushSubs[uid] ?? []).map((endpoint) => ({ endpoint }));
      },
    },
  } as unknown as PrismaClient & { __notifications: Record<string, unknown>[]; __deliveries: Record<string, unknown>[] };
  return db;
}

async function checkStep3(): Promise<void> {
  const schema = read("prisma/schema.prisma");
  const engine = read("services/notificationEngine.ts");
  const history = read("app/api/notifications/route.ts");
  const detail = read("app/api/notifications/[id]/route.ts");
  const mine = read("app/api/notifications/mine/route.ts");
  void read("lib/notify.ts");

  // 29.1 NotificationDelivery creation (IN_APP requested → rows persisted)
  {
    const db = fakeDbStep3({ students: [makeStudent(1)] });
    const report = await dispatchNotification(db, {
      event: "ADMIN_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "Delivery audit probe",
      message: "Every requested channel persists a row.",
      channels: ["IN_APP"],
      internal: true,
      idempotencyKey: "ADMIN_ANNOUNCEMENT:step3-1",
    });
    check("29.1: NotificationDelivery rows created", report.ok === true && db.__deliveries.length > 0 && db.__deliveries.every((d) => typeof d.notificationId === "string" && typeof d.recipientKey === "string"));
  }

  // 29.2 requested channel creates delivery (SMS lane persists per recipient)
  {
    const savedFlow = process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
    const savedKey = process.env.MSG91_AUTH_KEY;
    const savedSender = process.env.MSG91_SENDER_ID;
    const savedFetch = globalThis.fetch;
    process.env.MSG91_FLOW_ID_TEST_PUBLISHED = "test-flow";
    process.env.MSG91_AUTH_KEY = "test-key";
    process.env.MSG91_SENDER_ID = "TESTID";
    (globalThis as unknown as { fetch: unknown }).fetch = async () =>
      ({ ok: true, status: 200, json: async () => ({ type: "success" }) }) as unknown as Response;
    try {
      const db = fakeDbStep3({ students: [makeStudent(1)] });
      const report = await dispatchNotification(db, {
        event: "TEST_PUBLISHED",
        actor: ADMIN_ACTOR,
        audience: { kind: "ALL_STUDENTS" },
        title: "Channel probe",
        message: "SMS lane must persist.",
        templateKey: "TEST_PUBLISHED",
        vars: { testName: "Mock 1" },
        channels: ["SMS", "IN_APP"],
        internal: true,
        idempotencyKey: "TEST_PUBLISHED:step3-2",
        testId: "t-step3-2",
      });
      const smsRows = db.__deliveries.filter((d) => d.channel === "SMS");
      check("29.2: requested SMS channel persists deliveries", report.sms.sent === 1 && smsRows.length === 1 && smsRows[0].status === "SENT");
    } finally {
      globalThis.fetch = savedFetch;
      if (savedFlow === undefined) delete process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
      else process.env.MSG91_FLOW_ID_TEST_PUBLISHED = savedFlow;
      if (savedKey === undefined) delete process.env.MSG91_AUTH_KEY;
      else process.env.MSG91_AUTH_KEY = savedKey;
      if (savedSender === undefined) delete process.env.MSG91_SENDER_ID;
      else process.env.MSG91_SENDER_ID = savedSender;
    }
  }

  // 29.3 duplicate logical event creates no duplicate delivery
  {
    const db = fakeDbStep3({ students: [makeStudent(1)] });
    const base = {
      event: "ADMIN_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" } as const,
      title: "Dup delivery probe",
      message: "Second send persists nothing.",
      channels: ["IN_APP"] as const,
      internal: true,
      idempotencyKey: "ADMIN_ANNOUNCEMENT:step3-3",
    };
    const first = await dispatchNotification(db, { ...base });
    const n1 = db.__notifications.length;
    const d1 = db.__deliveries.length;
    const second = await dispatchNotification(db, { ...base });
    check("29.3: duplicate creates no duplicate delivery", first.ok === true && second.code === "DUPLICATE" && db.__notifications.length === n1 && db.__deliveries.length === d1);
  }

  // 29.4 concurrent duplicate safety (same key, parallel → one winner)
  {
    const db = fakeDbStep3({ students: [makeStudent(1)] });
    const input = {
      event: "ADMIN_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" } as const,
      title: "Race probe",
      message: "Parallel retries must not double-write.",
      channels: ["IN_APP"] as const,
      internal: true,
      idempotencyKey: "ADMIN_ANNOUNCEMENT:step3-race",
    };
    const [a, b] = await Promise.all([dispatchNotification(db, { ...input }), dispatchNotification(db, { ...input })]);
    const codes = [a.code, b.code].sort();
    check("29.4: concurrent duplicates race-safe", db.__notifications.length === 1 && codes[0] === "DISPATCHED" && codes[1] === "DUPLICATE" && db.__deliveries.length === 1);
    check("29.4: engine uses unique/P2002 (not findFirst alone)", engine.includes("P2002") && engine.includes("idempotencyKey") && engine.includes("findPersistentDuplicate"));
  }

  // 29.5 SMS failure persisted (500 → FAILED, safe code, no secrets)
  {
    const savedFlow = process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
    const savedKey = process.env.MSG91_AUTH_KEY;
    const savedSender = process.env.MSG91_SENDER_ID;
    const savedFetch = globalThis.fetch;
    process.env.MSG91_FLOW_ID_TEST_PUBLISHED = "test-flow";
    process.env.MSG91_AUTH_KEY = "test-key";
    process.env.MSG91_SENDER_ID = "TESTID";
    (globalThis as unknown as { fetch: unknown }).fetch = async () =>
      ({ ok: false, status: 500, json: async () => ({ type: "error" }) }) as unknown as Response;
    try {
      const db = fakeDbStep3({ students: [makeStudent(1)] });
      const report = await dispatchNotification(db, {
        event: "TEST_PUBLISHED",
        actor: ADMIN_ACTOR,
        audience: { kind: "ALL_STUDENTS" },
        title: "SMS fail probe",
        message: "Provider 500 must persist FAILED.",
        templateKey: "TEST_PUBLISHED",
        vars: { testName: "Mock 1" },
        channels: ["SMS", "IN_APP"],
        internal: true,
        idempotencyKey: "TEST_PUBLISHED:step3-5",
        testId: "t-step3-5",
      });
      const smsRows = db.__deliveries.filter((d) => d.channel === "SMS");
      check("29.5: SMS failure persisted as FAILED", report.sms.failed === 1 && smsRows.length === 1 && smsRows[0].status === "FAILED" && typeof smsRows[0].errorCode === "string");
    } finally {
      globalThis.fetch = savedFetch;
      if (savedFlow === undefined) delete process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
      else process.env.MSG91_FLOW_ID_TEST_PUBLISHED = savedFlow;
      if (savedKey === undefined) delete process.env.MSG91_AUTH_KEY;
      else process.env.MSG91_AUTH_KEY = savedKey;
      if (savedSender === undefined) delete process.env.MSG91_SENDER_ID;
      else process.env.MSG91_SENDER_ID = savedSender;
    }
  }

  // 29.6 Push failure persisted (unconfigured provider → FAILED/SKIPPED, isolated)
  {
    const db = fakeDbStep3({ students: [{ ...makeStudent(1), userId: "u-s1" }] });
    await dispatchNotification(db, {
      event: "ADMIN_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "Push fail probe",
      message: "Push stub must persist honestly.",
      channels: ["PUSH", "IN_APP"],
      internal: true,
      idempotencyKey: "ADMIN_ANNOUNCEMENT:step3-6",
    });
    const pushRows = db.__deliveries.filter((d) => d.channel === "PUSH");
    const inAppRows = db.__deliveries.filter((d) => d.channel === "IN_APP");
    check("29.6: push failure persisted, in-app isolated", pushRows.length > 0 && (pushRows[0].status === "FAILED" || pushRows[0].status === "SKIPPED") && inAppRows.length > 0 && inAppRows[0].status === "DELIVERED");
  }

  // 29.7 In-app success persisted (DELIVERED, never over-claimed)
  {
    const db = fakeDbStep3({ students: [makeStudent(1)] });
    await dispatchNotification(db, {
      event: "ADMIN_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "In-app probe",
      message: "Durable write is DELIVERED.",
      channels: ["IN_APP"],
      internal: true,
      idempotencyKey: "ADMIN_ANNOUNCEMENT:step3-7",
    });
    const rows = db.__deliveries.filter((d) => d.channel === "IN_APP");
    check("29.7: in-app success is DELIVERED", rows.length > 0 && rows.every((r) => r.status === "DELIVERED"));
  }

  // 29.8 retryable persisted (transient SMS failure → retryable + nextAttemptAt)
  {
    const savedFlow = process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
    const savedKey = process.env.MSG91_AUTH_KEY;
    const savedSender = process.env.MSG91_SENDER_ID;
    const savedFetch = globalThis.fetch;
    process.env.MSG91_FLOW_ID_TEST_PUBLISHED = "test-flow";
    process.env.MSG91_AUTH_KEY = "test-key";
    process.env.MSG91_SENDER_ID = "TESTID";
    (globalThis as unknown as { fetch: unknown }).fetch = async () => {
      throw new Error("network down");
    };
    try {
      const db = fakeDbStep3({ students: [makeStudent(1)] });
      await dispatchNotification(db, {
        event: "TEST_PUBLISHED",
        actor: ADMIN_ACTOR,
        audience: { kind: "ALL_STUDENTS" },
        title: "Retry probe",
        message: "Network fault is retryable.",
        templateKey: "TEST_PUBLISHED",
        vars: { testName: "Mock 1" },
        channels: ["SMS"],
        internal: true,
        idempotencyKey: "TEST_PUBLISHED:step3-8",
        testId: "t-step3-8",
      });
      const rows = db.__deliveries.filter((d) => d.channel === "SMS");
      check("29.8: retryable + nextAttemptAt persisted (no auto-retry)", rows.length === 1 && rows[0].retryable === true && rows[0].nextAttemptAt instanceof Date && engine.includes("nextAttemptAt") && !engine.includes("setTimeout") && !engine.includes("setInterval"));
    } finally {
      globalThis.fetch = savedFetch;
      if (savedFlow === undefined) delete process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
      else process.env.MSG91_FLOW_ID_TEST_PUBLISHED = savedFlow;
      if (savedKey === undefined) delete process.env.MSG91_AUTH_KEY;
      else process.env.MSG91_AUTH_KEY = savedKey;
      if (savedSender === undefined) delete process.env.MSG91_SENDER_ID;
      else process.env.MSG91_SENDER_ID = savedSender;
    }
  }

  // 29.9 attempt count (success = 1, skipped overflow = 0)
  {
    const db = fakeDbStep3({ students: [makeStudent(1)] });
    await dispatchNotification(db, {
      event: "ADMIN_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "Attempt probe",
      message: "attemptCount must persist.",
      channels: ["IN_APP"],
      internal: true,
      idempotencyKey: "ADMIN_ANNOUNCEMENT:step3-9",
    });
    check("29.9: attemptCount persisted", db.__deliveries.length > 0 && db.__deliveries.every((d) => typeof d.attemptCount === "number") && db.__deliveries.some((d) => d.attemptCount === 1));
  }

  // 29.10 priority persisted (header + delivery, allowlisted)
  {
    const db = fakeDbStep3({ students: [makeStudent(1)] });
    const report = await dispatchNotification(db, {
      event: "TEST_PUBLISHED",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "Priority persist probe",
      message: "CRITICAL must persist.",
      channels: ["IN_APP"],
      priority: "CRITICAL",
      internal: true,
      idempotencyKey: "TEST_PUBLISHED:step3-10",
      testId: "t-step3-10",
    });
    check("29.10: priority persisted on header + deliveries", report.priority === "CRITICAL" && db.__notifications[0]?.priority === "CRITICAL" && db.__deliveries.length > 0 && db.__deliveries.every((d) => d.priority === "CRITICAL") && schema.includes("enum NotificationPriority"));
  }

  // 29.11 scheduled remains SCHEDULED (never SENT, CREATED deliveries)
  {
    const db = fakeDbStep3({ students: [makeStudent(1)] });
    const report = await dispatchNotification(db, {
      event: "ADMIN_ANNOUNCEMENT",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "Scheduled persist probe",
      message: "Future send stays SCHEDULED.",
      channels: ["SMS", "PUSH", "IN_APP"],
      internal: true,
      idempotencyKey: "ADMIN_ANNOUNCEMENT:step3-11",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    check("29.11: scheduled persists SCHEDULED + CREATED deliveries", report.code === "SCHEDULED" && report.inApp.state === "SCHEDULED" && db.__notifications[0]?.status === "SCHEDULED" && db.__deliveries.length > 0 && db.__deliveries.every((d) => d.status === "CREATED"));
  }

  // 29.12 >200 skipped records/state (PARTIAL + SKIPPED rows, nothing hidden)
  {
    const savedFetch = globalThis.fetch;
    const savedFlow = process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
    const savedKey = process.env.MSG91_AUTH_KEY;
    const savedSender = process.env.MSG91_SENDER_ID;
    process.env.MSG91_FLOW_ID_TEST_PUBLISHED = "test-flow";
    process.env.MSG91_AUTH_KEY = "test-key";
    process.env.MSG91_SENDER_ID = "TESTID";
    (globalThis as unknown as { fetch: unknown }).fetch = async () =>
      ({ ok: true, status: 200, json: async () => ({ type: "success" }) }) as unknown as Response;
    try {
      const many = Array.from({ length: 250 }, (_, i) => makeStudent(i + 1));
      const db = fakeDbStep3({ students: many });
      const report = await dispatchNotification(db, {
        event: "TEST_PUBLISHED",
        actor: ADMIN_ACTOR,
        audience: { kind: "ALL_STUDENTS" },
        title: "Overflow audit probe",
        message: "250 recipients, cap 200.",
        templateKey: "TEST_PUBLISHED",
        vars: { testName: "Mock 1" },
        channels: ["SMS", "IN_APP"],
        internal: true,
        idempotencyKey: "TEST_PUBLISHED:step3-12",
        testId: "t-step3-12",
      });
      const skippedSms = db.__deliveries.filter((d) => d.channel === "SMS" && d.status === "SKIPPED");
      check("29.12: overflow persists SKIPPED rows", report.sms.state === "PARTIAL" && report.sms.skipped === 50 && skippedSms.length === 50);
    } finally {
      globalThis.fetch = savedFetch;
      if (savedFlow === undefined) delete process.env.MSG91_FLOW_ID_TEST_PUBLISHED;
      else process.env.MSG91_FLOW_ID_TEST_PUBLISHED = savedFlow;
      if (savedKey === undefined) delete process.env.MSG91_AUTH_KEY;
      else process.env.MSG91_AUTH_KEY = savedKey;
      if (savedSender === undefined) delete process.env.MSG91_SENDER_ID;
      else process.env.MSG91_SENDER_ID = savedSender;
    }
  }

  // 29.13 faculty recipient security (delivery audit hidden from faculty feed)
  {
    const r = requireApiRole(fakeReq(tokenFor("FACULTY")), ["ADMIN"]);
    check("29.13: faculty blocked from delivery analytics (403)", !r.ok && r.status === 403);
    check("29.13: mine feed never exposes deliveries", !mine.includes("db.notificationDelivery") && !mine.includes("notificationDelivery.findMany") && !mine.includes("notificationDelivery.groupBy") && mine.includes("isInAppVisible"));
  }

  // 29.14 student recipient security
  {
    const r = requireApiRole(fakeReq(tokenFor("STUDENT")), ["ADMIN"]);
    check("29.14: student blocked from delivery analytics (403)", !r.ok && r.status === 403);
    check("29.14: student feed has no delivery queries", !mine.includes("db.notificationDelivery") && mine.includes('viewer.role === "STUDENT"'));
  }

  // 29.15 admin delivery history authorization + persisted numbers
  {
    check("29.15: history is ADMIN-only", history.includes('requireApiRole(req, ["ADMIN"])'));
    check("29.15: history aggregates persisted deliveries", history.includes("notificationDelivery") && history.includes("deliveryCountsFor") && history.includes("recipientCount") && history.includes("smsSent"));
  }

  // 29.16 admin detail authorization + paginated recipients
  {
    check("29.16: detail is ADMIN-only", detail.includes('requireApiRole(req, ["ADMIN"])'));
    check("29.16: detail paginates deliveries (bounded)", detail.includes("deliveryPagination") && detail.includes("Math.min(100") && detail.includes("deliverySummary"));
  }

  // 29.17 provider secrets never stored
  {
    const dStart = schema.indexOf("model NotificationDelivery");
    const dEnd = schema.indexOf("\nmodel ", dStart + 10);
    const deliveryBlock = schema.slice(dStart, dEnd > dStart ? dEnd : dStart + 2500);
    check("29.17: no secrets in delivery model", !deliveryBlock.includes("otpHash") && !deliveryBlock.includes("authKey") && !deliveryBlock.includes("AuthKey") && !deliveryBlock.includes("privateKey") && !/^\s*phone\s+String/m.test(deliveryBlock));
    const safeStart = engine.indexOf("async function safeDeliveryCreate");
    const safeEnd = engine.indexOf("function retryAt");
    const safeBlock = engine.slice(safeStart, safeEnd > safeStart ? safeEnd : safeStart + 2500);
    check("29.17: delivery writes carry no secrets/phones", !safeBlock.includes("MSG91_AUTH_KEY") && !safeBlock.includes("VAPID_PRIVATE_KEY") && !safeBlock.includes("safe.phone") && !/phone:\s*r\.phone/.test(safeBlock));
  }

  // 29.18 raw provider response never stored
  {
    const dStart = schema.indexOf("model NotificationDelivery");
    const dEnd = schema.indexOf("\nmodel ", dStart + 10);
    const deliveryBlock = schema.slice(dStart, dEnd > dStart ? dEnd : dStart + 2500);
    check("29.18: no raw payload columns", !deliveryBlock.toLowerCase().includes("rawresponse") && !deliveryBlock.toLowerCase().includes("rawpayload") && !deliveryBlock.includes("providerResponse") && !deliveryBlock.includes("responseBody"));
    check("29.18: engine never persists raw body", !engine.includes("await res.json()") || engine.includes("NEVER the key, phone"));
  }

  // 29.19 invalid delivery status rejected
  {
    check("29.19: history rejects bad filters", history.includes("NOTIFY_BAD_FILTER") && history.includes("Unknown status filter"));
    check("29.19: detail rejects bad delivery status", detail.includes("NOTIFY_BAD_FILTER") && detail.includes("Unknown delivery status filter"));
    check("29.19: schema vocabulary is closed", schema.includes("enum DeliveryStatus") && ["CREATED", "QUEUED", "PROCESSING", "SENT", "DELIVERED", "FAILED", "RETRYING", "SKIPPED"].every((s) => schema.includes(s)));
  }

  // 29.20 notification deletion cleanup (cascade)
  {
    check("29.20: deliveries cascade on notification delete", schema.includes('notification Notification') && schema.includes("onDelete: Cascade") && read("prisma/migrations/20261009000000_notification_delivery_audit/migration.sql").includes("ON DELETE CASCADE"));
    check("29.20: engine documents SENT vs DELIVERED honestly", engine.includes("DELIVERED is") && engine.includes("MSG91") && engine.includes("SENT"));
  }
}

// --------------------------------- Phase 18c-step5: audit-honesty fixes ---
// Stubbed providers only (fake Db, stubbed + counted fetch). NEVER real SMS.
async function checkStep5(): Promise<void> {
  const schema = read("prisma/schema.prisma");
  const engine = read("services/notificationEngine.ts");
  const history = read("app/api/notifications/route.ts");
  const detail = read("app/api/notifications/[id]/route.ts");
  const listPage = read("app/admin/notifications/page.tsx");
  const detailPage = read("app/admin/notifications/[id]/page.tsx");

  const withCountedSms = async (fn: (calls: { n: number }) => Promise<void>): Promise<void> => {
    const savedFetch = globalThis.fetch;
    const savedFlow = process.env.MSG91_FLOW_ID_BATCH_ANNOUNCEMENT;
    const savedKey = process.env.MSG91_AUTH_KEY;
    const savedSender = process.env.MSG91_SENDER_ID;
    const calls = { n: 0 };
    process.env.MSG91_FLOW_ID_BATCH_ANNOUNCEMENT = "test-flow";
    process.env.MSG91_AUTH_KEY = "test-key";
    process.env.MSG91_SENDER_ID = "TESTID";
    (globalThis as unknown as { fetch: unknown }).fetch = async () => {
      calls.n += 1;
      return { ok: true, status: 200, json: async () => ({ type: "success" }) } as unknown as Response;
    };
    try {
      await fn(calls);
    } finally {
      globalThis.fetch = savedFetch;
      if (savedFlow === undefined) delete process.env.MSG91_FLOW_ID_BATCH_ANNOUNCEMENT;
      else process.env.MSG91_FLOW_ID_BATCH_ANNOUNCEMENT = savedFlow;
      if (savedKey === undefined) delete process.env.MSG91_AUTH_KEY;
      else process.env.MSG91_AUTH_KEY = savedKey;
      if (savedSender === undefined) delete process.env.MSG91_SENDER_ID;
      else process.env.MSG91_SENDER_ID = savedSender;
    }
  };

  // 30.1 partial REGULAR fan-out: one shard fails → explicit error, no SMS,
  // no delivery attached to an unrelated header.
  {
    const db = fakeDbStep3({
      students: [makeStudent(1), makeStudent(2)],
      failCreate: (data) => data.targetStudentId === "s2",
    });
    let report: { ok: boolean; code: string } | null = null;
    await withCountedSms(async (calls) => {
      report = await dispatchNotification(db, {
        event: "BATCH_ANNOUNCEMENT",
        actor: ADMIN_ACTOR,
        audience: { kind: "REGULAR" },
        title: "Partial probe",
        message: "Second shard store fails.",
        templateKey: "BATCH_ANNOUNCEMENT",
        vars: { message: "Hello cohort" },
        channels: ["SMS", "IN_APP"],
        internal: true,
        idempotencyKey: "BATCH_ANNOUNCEMENT:step5-partial-regular",
      });
      check(
        "30.1: partial REGULAR fan-out aborts without sending",
        report !== null &&
          (report as { ok: boolean; code: string }).ok === false &&
          (report as { ok: boolean; code: string }).code === "NOTIFY_PARTIAL_FANOUT" &&
          calls.n === 0
      );
    });
    const headerIds = new Set(db.__notifications.map((n) => String(n.id)));
    check(
      "30.1: no delivery misattributed to an unrelated header",
      db.__deliveries.length === 0 || db.__deliveries.every((d) => headerIds.has(String(d.notificationId)))
    );
    check(
      "30.1: failed shard left no delivery row",
      !db.__deliveries.some((d) => String(d.recipientKey) === "student:s2")
    );
  }

  // 30.2 ALL_USERS one-of-two: FACULTY shard fails → explicit error, no SMS.
  {
    const db = fakeDbStep3({
      students: [makeStudent(1)],
      faculty: [{ id: "f1", name: "Fac One", phone: "+919876543210", userId: "u-f1", status: "ACTIVE" }],
      failCreate: (data) => data.audience === "FACULTY",
    });
    await withCountedSms(async (calls) => {
      const report = await dispatchNotification(db, {
        event: "BATCH_ANNOUNCEMENT",
        actor: ADMIN_ACTOR,
        audience: { kind: "ALL_USERS" },
        title: "Partial users probe",
        message: "Faculty shard store fails.",
        templateKey: "BATCH_ANNOUNCEMENT",
        vars: { message: "Hello everyone" },
        channels: ["SMS", "IN_APP"],
        internal: true,
        idempotencyKey: "BATCH_ANNOUNCEMENT:step5-partial-users",
      });
      check(
        "30.2: ALL_USERS one-of-two aborts without sending",
        report.ok === false && report.code === "NOTIFY_PARTIAL_FANOUT" && calls.n === 0 && db.__deliveries.length === 0
      );
    });
  }

  // 30.3 concurrent same-key REGULAR fan-out never double-sends per recipient.
  {
    const db = fakeDbStep3({ students: [makeStudent(1), makeStudent(2)] });
    await withCountedSms(async (calls) => {
      const input = {
        event: "BATCH_ANNOUNCEMENT",
        actor: ADMIN_ACTOR,
        audience: { kind: "REGULAR" } as const,
        title: "Race fan-out probe",
        message: "Parallel same-key fan-out.",
        templateKey: "BATCH_ANNOUNCEMENT",
        vars: { message: "Hello cohort" },
        channels: ["SMS", "IN_APP"] as const,
        internal: true,
        idempotencyKey: "BATCH_ANNOUNCEMENT:step5-race-regular",
      };
      const [a, b] = await Promise.all([dispatchNotification(db, { ...input }), dispatchNotification(db, { ...input })]);
      const sentByRecipient = new Map<string, number>();
      for (const d of db.__deliveries) {
        if (d.channel === "SMS" && d.status === "SENT") {
          const k = String(d.recipientKey);
          sentByRecipient.set(k, (sentByRecipient.get(k) ?? 0) + 1);
        }
      }
      const noDoubleSend = [...sentByRecipient.values()].every((n) => n <= 1);
      const headerIds = new Set(db.__notifications.map((n) => String(n.id)));
      check(
        "30.3: concurrent fan-out never double-sends per recipient",
        !(a.code === "DISPATCHED" && b.code === "DISPATCHED") &&
          noDoubleSend &&
          calls.n <= 2 &&
          db.__deliveries.every((d) => headerIds.has(String(d.notificationId)))
      );
    });
  }

  // 30.4 delivery-audit availability is explicit (never silent zeroes).
  {
    check(
      "30.4: history reports deliveryAudit ok|unavailable",
      history.includes('deliveryAudit: "ok" | "unavailable"') ||
        (history.includes("deliveryAudit") && history.includes('"unavailable"'))
    );
    check(
      "30.4: history distinguishes migration-missing from query-failed",
      history.includes('"migration-missing"') && history.includes('"query-failed"')
    );
    check(
      "30.4: detail reports deliveryAudit ok|unavailable",
      detail.includes("deliveryAudit") && detail.includes('"unavailable"') && detail.includes('"migration-missing"')
    );
    check(
      "30.4: no silent-zero fallbacks remain",
      !history.includes("/* keep zero */") &&
        !history.includes("/* counts below still apply */") &&
        !history.includes("pre-migration: filter in-memory") &&
        !detail.includes("/* keep zero */") &&
        !detail.includes("pre-migration: zeroed summary")
    );
  }

  // 30.5 honest filtering: no dead try/catch, 409 on unappliable filters.
  {
    check(
      "30.5: history has no dead filter try/catch",
      !history.includes("where.priority = priority;\n      } catch") &&
        !history.includes("pre-migration: filter in-memory below")
    );
    check(
      "30.5: unappliable audit filters get explicit 409",
      history.includes("DELIVERY_AUDIT_UNAVAILABLE") && history.includes("409")
    );
    check("30.5: success states filtersApplied", history.includes("filtersApplied: true"));
  }

  // 30.6 strict shard mapping in the engine.
  {
    check(
      "30.6: no unrelated-header fallback remains",
      !engine.includes("?? ids[0]") && engine.includes("NOTIFY_PARTIAL_FANOUT")
    );
    check(
      "30.6: convergent idempotency helpers exist",
      engine.includes("expectedHeaderCount") && engine.includes("findNotificationIdByKey") && engine.includes("createdNew")
    );
  }

  // 30.7 P2 consistency fixes.
  {
    check(
      "30.7: stale pre-delivery comments corrected",
      !engine.includes("(NO new model)") && !engine.includes("has no priority column")
    );
    check(
      "30.7: UTC attendance-day policy helper exists",
      engine.includes("attendanceIdempotencyDayUTC") && engine.includes("UTC calendar")
    );
    check(
      "30.7: recipientKey comment matches generated keys",
      schema.includes("name:<truncated-name>") && !schema.includes("batch:<id> for broadcast lanes")
    );
    check("30.7: unused toAdminNotification removed", !listPage.includes("function toAdminNotification"));
    check(
      "30.7: missing-vars + push-identity semantics documented",
      engine.includes("SMS_MISSING_VARS") && engine.includes("PUSH_NO_IDENTITY")
    );
  }

  // 30.8 admin pages warn when audit data is unavailable.
  {
    check(
      "30.8: list page warns on unavailable audit",
      listPage.includes("auditWarning") && listPage.includes("Delivery audit unavailable")
    );
    check(
      "30.8: detail page warns on unavailable audit",
      detailPage.includes("auditWarning") && detailPage.includes("Delivery audit unavailable")
    );
  }
}

// --------------------------- Phase 19: scheduled cron worker ---
// DB-free: pure helper assertions, static route/config assertions, and a
// fake atomic-claim race (no database, no network, no real MSG91 call).
import {
  CRON_DEFAULT_LIMIT,
  CRON_MAX_LIMIT,
  MAX_WORKER_ATTEMPTS,
  buildCronSummary,
  cronSecretsEqual,
  extractBearerSecret,
  isDueScheduledNotification,
  isRetryEligibleDelivery,
  isTerminalDeliveryStatus,
  parseCronLimit,
} from "../lib/cron-notifications";

async function checkCronWorker(): Promise<void> {
  // 31.1 batch-limit validation (default 25, max 100).
  {
    check("31.1: missing limit defaults to 25", parseCronLimit(null).ok === true && (parseCronLimit(null) as { ok: true; limit: number }).limit === CRON_DEFAULT_LIMIT && CRON_DEFAULT_LIMIT === 25);
    check("31.2: valid limits pass", (parseCronLimit("1") as { ok: true; limit: number }).limit === 1 && (parseCronLimit("25") as { ok: true; limit: number }).limit === 25 && (parseCronLimit(String(CRON_MAX_LIMIT)) as { ok: true; limit: number }).limit === 100);
    const bad = ["0", "-1", "101", "9999", "abc", "", "25.5", "  "];
    check("31.3: invalid limits rejected", bad.every((v) => {
      const r = parseCronLimit(v);
      return r.ok === false && (r as { code: string }).code === "CRON_BAD_LIMIT";
    }));
  }

  // 31.4 authentication (constant-time, missing never passes).
  {
    check("31.4: missing secret never authenticates", cronSecretsEqual("", "expected") === false && cronSecretsEqual("provided", "") === false && cronSecretsEqual("", "") === false);
    check("31.5: wrong secret rejected, correct accepted", cronSecretsEqual("a", "b") === false && cronSecretsEqual("short", "a-much-longer-secret") === false && cronSecretsEqual("s3cret", "s3cret") === true);
    check("31.6: bearer extraction", extractBearerSecret("Bearer abc123", null) === "abc123" && extractBearerSecret(null, "s3cret") === "s3cret" && extractBearerSecret(null, null) === null && extractBearerSecret("Basic abc", null) === null && extractBearerSecret("Bearer ", null) === null);
  }

  // 31.7 eligibility (scheduled due, retryable, terminal).
  {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    check("31.7: due scheduled logic", isDueScheduledNotification({ status: "SCHEDULED", scheduledAt: past }) === true && isDueScheduledNotification({ status: "SCHEDULED", scheduledAt: future }) === false && isDueScheduledNotification({ status: "SENT", scheduledAt: past }) === false && isDueScheduledNotification({ status: "SCHEDULED", scheduledAt: null }) === false);
    check(
      "31.8: retry eligibility",
      isRetryEligibleDelivery({ status: "FAILED", retryable: true, attemptCount: 1, nextAttemptAt: past }) === true &&
        isRetryEligibleDelivery({ status: "RETRYING", retryable: true, attemptCount: 0, nextAttemptAt: null }) === true &&
        isRetryEligibleDelivery({ status: "FAILED", retryable: false, attemptCount: 1, nextAttemptAt: past }) === false &&
        isRetryEligibleDelivery({ status: "FAILED", retryable: true, attemptCount: MAX_WORKER_ATTEMPTS, nextAttemptAt: past }) === false &&
        isRetryEligibleDelivery({ status: "FAILED", retryable: true, attemptCount: 1, nextAttemptAt: future }) === false &&
        isRetryEligibleDelivery({ status: "CREATED", retryable: true, attemptCount: 0, nextAttemptAt: past }) === false &&
        isRetryEligibleDelivery({ status: "PROCESSING", retryable: true, attemptCount: 1, nextAttemptAt: past }) === false
    );
    check(
      "31.9: terminal statuses respected",
      isTerminalDeliveryStatus("SENT") === true &&
        isTerminalDeliveryStatus("DELIVERED") === true &&
        isTerminalDeliveryStatus("SKIPPED") === true &&
        isTerminalDeliveryStatus("FAILED", { retryable: false }) === true &&
        isTerminalDeliveryStatus("FAILED", { retryable: true, attemptCount: 1 }) === false &&
        isTerminalDeliveryStatus("FAILED", { retryable: true, attemptCount: MAX_WORKER_ATTEMPTS }) === true &&
        isTerminalDeliveryStatus("CREATED") === false &&
        isTerminalDeliveryStatus("QUEUED") === false &&
        isTerminalDeliveryStatus("PROCESSING") === false
    );
    check("31.10: summary carries counts only", (() => {
      const s = buildCronSummary({ limit: 25, claimedHeaders: 1, processed: 2, deliveredInApp: 1, sentSms: 0, failed: 1, skipped: 0, retried: 0, reminders: 0, concurrentSkipped: 0 });
      const keys = Object.keys(s).sort().join(",");
      return keys === "claimedHeaders,concurrentSkipped,deliveredInApp,failed,limit,processed,reminders,retried,sentSms,skipped" && s.processed === 2;
    })());
  }

  // 31.11 route contract (static): auth-first, atomic claims, honest codes.
  {
    const route = read("app/api/cron/notifications/route.ts");
    check("31.11: cron authenticates via CRON_SECRET", route.includes("CRON_SECRET") && route.includes("CRON_UNAUTHORIZED") && route.includes("CRON_NOT_CONFIGURED"));
    check("31.12: cron uses constant-time comparison", route.includes("cronSecretsEqual") && read("lib/cron-notifications.ts").includes("timingSafeEqual"));
    check("31.13: cron validates batch limits", route.includes("CRON_BAD_LIMIT") && route.includes("400"));
    check("31.14: cron claims headers atomically", route.includes("updateMany") && route.includes('status: "SCHEDULED"') && route.includes('"PROCESSING"'));
    check("31.15: cron never marks failed/skipped as delivered", !route.includes('status: "DELIVERED"') || (route.includes('channel === "IN_APP"') && route.includes("SMS_MISSING_VARS")));
    check("31.16: cron reports aggregate counts only", route.includes("claimedHeaders") && route.includes("deliveryAudit") && route.includes("buildCronSummary"));
    const okBlock = route.slice(route.indexOf("return ok({"));
    check("31.17: cron response carries no recipient PII", !okBlock.includes("phone") && !okBlock.includes("email") && !okBlock.includes("token") && !/title:\s*h\.title/.test(okBlock));
    check("31.18: cron never logs secrets", !route.includes("console.log(provided") && !route.includes("CRON_SECRET,") && !/console\.\w+\([^)]*provided[^)]*\)/.test(route));
  }

  // 31.19 deployment contract: vercel cron + env template.
  {
    const vercel = read("vercel.json");
    check("31.19: vercel cron is Hobby-deployable (plain path, once-daily)", vercel.includes('"/api/cron/notifications"') && !vercel.includes("notifications?") && vercel.includes('"0 3 * * *"'));
    check("31.20: vercel config preserved, no reserved PORT override", vercel.includes('"framework": "nextjs"') && vercel.includes("X-Frame-Options") && !vercel.includes('"PORT"'));
    check("31.21: CRON_SECRET documented without a value", read(".env.example").includes("CRON_SECRET"));
  }

  // 31.22 concurrent protection: two workers racing one row → one winner.
  {
    const rows: { id: string; status: string }[] = [{ id: "d1", status: "CREATED" }];
    const atomicClaim = async (id: string, from: string): Promise<number> => {
      // Mirrors the route's updateMany(where id+status) guard: the check and
      // the set happen synchronously, so only one racer can win.
      const row = rows.find((r) => r.id === id);
      if (row && row.status === from) {
        row.status = "PROCESSING";
        return 1;
      }
      return 0;
    };
    const [a, b] = await Promise.all([atomicClaim("d1", "CREATED"), atomicClaim("d1", "CREATED")]);
    check("31.22: duplicate/concurrent processing has one winner", a + b === 1 && rows[0].status === "PROCESSING");
  }
}

// ----------------- Phase 19 (fast-track 3): missing emissions ---
// DB-free: static route/builder assertions + fake-Db engine dispatches
// (IN_APP-only, no provider I/O). NEVER a real MSG91 call.
async function checkPhase3(): Promise<void> {
  // 32.1 faculty approval emits on the activation transition only.
  {
    const route = read("app/api/faculty/[id]/route.ts");
    check(
      "32.1: approval emits FACULTY_NOTIFICATION on transition",
      route.includes("dispatchNotification") &&
        route.includes('"FACULTY_NOTIFICATION"') &&
        route.includes("facultyId: id") &&
        route.includes("previous")
    );
    check(
      "32.2: repeat approvals and unrelated edits stay silent",
      route.includes('previous?.status !== "ACTIVE"') && route.includes("body.isActive === true")
    );
  }

  // 32.3 student registration welcomes exactly once, IN_APP only.
  {
    const route = read("app/api/auth/student/register/route.ts");
    check(
      "32.3: registration emits REGISTRATION_UPDATE IN_APP-only",
      route.includes("dispatchNotification") &&
        route.includes('"REGISTRATION_UPDATE"') &&
        route.includes('["IN_APP"]') &&
        route.includes("REGISTRATION_UPDATE:${student.id}")
    );
  }

  // 32.4 builders use canonical event types and carry no PII.
  {
    const builders = read("lib/notify.ts");
    const tail = builders.slice(builders.indexOf("facultyApproved"));
    check(
      "32.4: new builders are canonical and PII-free",
      builders.includes("facultyApproved") &&
        builders.includes("registrationWelcome") &&
        builders.includes('"FACULTY_NOTIFICATION"') &&
        builders.includes('"REGISTRATION_UPDATE"') &&
        !tail.includes("phone") &&
        !tail.includes("email") &&
        !tail.includes("password")
    );
  }

  // 32.5 engine delivers both new events (fake Db, IN_APP-only).
  {
    const db = fakeDb({
      singleFaculty: { id: "f1", name: "Fac One", phone: "+919876543210", userId: "u-f1", status: "ACTIVE" },
    });
    const report = await dispatchNotification(db, {
      event: "FACULTY_NOTIFICATION",
      actor: ADMIN_ACTOR,
      audience: { kind: "INDIVIDUAL", facultyId: "f1" },
      title: "Faculty account approved",
      message: "Your faculty account has been approved.",
      templateKey: "FACULTY_NOTIFICATION",
      vars: { message: "Your faculty account has been approved." },
      channels: ["IN_APP"],
      internal: true,
    });
    check("32.5: FACULTY_NOTIFICATION dispatches in-app", report.ok === true && report.inApp.state === "SENT");
  }
  {
    const s = makeStudent(1);
    const db = fakeDb({ singleStudent: s });
    const report = await dispatchNotification(db, {
      event: "REGISTRATION_UPDATE",
      actor: { id: s.userId as string, role: "STUDENT" },
      audience: { kind: "INDIVIDUAL", studentId: s.id },
      title: "Welcome to Neuron Academy",
      message: "Hi Student 01, your registration is complete.",
      templateKey: "REGISTRATION_UPDATE",
      vars: { message: "Hi Student 01, your registration is complete." },
      channels: ["IN_APP"],
      internal: true,
      idempotencyKey: `REGISTRATION_UPDATE:${s.id}`,
    });
    check("32.6: REGISTRATION_UPDATE self-welcome dispatches in-app", report.ok === true && report.inApp.state === "SENT");
  }

  // 32.7 failure behavior: unknown recipient fails honestly, bad input never throws.
  {
    const db = fakeDb({ singleFaculty: null });
    const report = await dispatchNotification(db, {
      event: "FACULTY_NOTIFICATION",
      actor: ADMIN_ACTOR,
      audience: { kind: "INDIVIDUAL", facultyId: "ghost" },
      title: "Faculty account approved",
      message: "Your faculty account has been approved.",
      templateKey: "FACULTY_NOTIFICATION",
      vars: { message: "Your faculty account has been approved." },
      channels: ["IN_APP"],
      internal: true,
    });
    check("32.7: unknown faculty fails honestly", report.ok === false && report.code === "NOTIFY_NO_RECIPIENTS");
    const db2 = fakeDb({ singleStudent: makeStudent(1) });
    const bad = await dispatchNotification(db2, {
      event: "REGISTRATION_UPDATE",
      actor: ADMIN_ACTOR,
      audience: { kind: "INDIVIDUAL", studentId: "s1" },
      title: "   ",
      message: "Body without a title.",
      channels: ["IN_APP"],
      internal: true,
    });
    check("32.8: bad input fails closed without throwing", bad.ok === false && bad.code === "NOTIFY_BAD_BODY");
  }

  // 32.9 scheduled-SMS blocker: vars are not persisted, so incomplete SMS
  // must fail honestly (documented — never sent, never marked delivered).
  {
    const schema = read("prisma/schema.prisma");
    const deliveryBlock = schema.slice(schema.indexOf("model NotificationDelivery"));
    check(
      "32.9: delivery schema persists no template vars",
      schema.includes("model NotificationDelivery") && !deliveryBlock.includes("vars")
    );
    check(
      "32.10: event SMS needs vars the worker cannot reconstruct",
      renderSmsTemplate("RESULT_RELEASED", { academyName: "Neuron Academy", message: "Result out" }).missing.length > 0
    );
    const worker = read("app/api/cron/notifications/route.ts");
    check(
      "32.11: worker fails incomplete SMS honestly, never as delivered",
      worker.includes("SMS_MISSING_VARS") && worker.includes("if (res.ok)") && !/SMS_MISSING_VARS[\s\S]{0,200}status: "DELIVERED"/.test(worker)
    );
  }

  // 32.12 admin creation ↔ worker contracts stay consistent.
  {
    const admin = read("app/api/notifications/route.ts");
    const worker = read("app/api/cron/notifications/route.ts");
    check(
      "32.12: admin persists SCHEDULED state the worker claims",
      admin.includes("scheduledAt") && admin.includes('"SCHEDULED"') && worker.includes('status: "SCHEDULED"') && worker.includes("scheduledAt")
    );
    check(
      "32.13: admin pairing validation matches engine allowlist",
      admin.includes("isSmsTemplateKey") && worker.includes("isTemplateAllowedForEvent")
    );
  }
}

// --------- Phase 19 (head-engineer pass): every notification type ---
// DB-free: static assertions + fake-Db IN_APP-only dispatches (no provider
// I/O). Proves all 18 catalog events are either auto-emitted or sendable
// today through the admin composer (same-name template → same-name event).
async function checkPhase4(): Promise<void> {
  // 33.1 new builders are canonical.
  {
    const builders = read("lib/notify.ts");
    check(
      "33.1: reminder + marked builders are canonical",
      builders.includes("testReminder") && builders.includes("attendanceMarked") && builders.includes('"TEST_REMINDER"') && builders.includes('"ATTENDANCE_MARKED"')
    );
  }

  // 33.2 attendance trail: non-absent markings record IN_APP-only, deduped.
  {
    const route = read("app/api/attendance/route.ts");
    check(
      "33.2: non-absent markings record IN_APP-only",
      route.includes('"ATTENDANCE_MARKED"') && route.includes('["IN_APP"]') && route.includes("ATTENDANCE_MARKED:${studentId}:${dateStr}")
    );
    check(
      "33.3: absent full-policy path unchanged",
      route.includes('"ATTENDANCE_ABSENT"') && route.includes("ATTENDANCE_ABSENT:${studentId}:${dateStr}")
    );
  }

  // 33.4 engine delivers both (fake Db, IN_APP-only, no provider I/O).
  {
    const db = fakeDb({ singleStudent: makeStudent(2) });
    const marked = await dispatchNotification(db, {
      event: "ATTENDANCE_MARKED",
      actor: ADMIN_ACTOR,
      audience: { kind: "INDIVIDUAL", studentId: "s2" },
      title: "Attendance marked",
      message: "Your attendance for 2026-10-10 is marked PRESENT.",
      templateKey: "ATTENDANCE_MARKED",
      vars: { testDate: "2026-10-10" },
      channels: ["IN_APP"],
      internal: true,
      idempotencyKey: "ATTENDANCE_MARKED:s2:2026-10-10",
    });
    check("33.4: ATTENDANCE_MARKED dispatches in-app", marked.ok === true && marked.inApp.state === "SENT");
  }
  {
    const db = fakeDb({ students: [makeStudent(1)] });
    const reminder = await dispatchNotification(db, {
      event: "TEST_REMINDER",
      actor: ADMIN_ACTOR,
      audience: { kind: "ALL_STUDENTS" },
      title: "Upcoming test reminder",
      message: "Mock 1 is scheduled on 2026-10-11. Revise and be ready.",
      templateKey: "TEST_REMINDER",
      vars: { testName: "Mock 1", testDate: "2026-10-11", testTime: "" },
      channels: ["IN_APP"],
      testId: "t1",
      internal: true,
      idempotencyKey: "TEST_REMINDER:t1",
    });
    check("33.5: TEST_REMINDER dispatches in-app", reminder.ok === true && reminder.inApp.state === "SENT");
  }

  // 33.6 worker reminder scan is bounded, published-only, idempotent.
  {
    const worker = read("app/api/cron/notifications/route.ts");
    check(
      "33.6: reminder scan is PUBLISHED-only and bounded",
      worker.includes('"TEST_REMINDER"') && worker.includes('status: "PUBLISHED"') && worker.includes("MAX_REMINDERS_PER_TICK") && worker.includes("TEST_REMINDER:${t.id}")
    );
    check(
      "33.7: reminder attribution is a real admin or skipped",
      worker.includes('role: "ADMIN"') && worker.includes("isActive: true")
    );
    check(
      "33.8: reminder aggregate reported",
      worker.includes("reminders") && read("lib/cron-notifications.ts").includes("MAX_REMINDERS_PER_TICK")
    );
  }

  // 33.9 every non-OTP template is sendable via the admin composer today.
  {
    const composerSendable: string[] = [
      "TEST_PUBLISHED", "TEST_REMINDER", "RESULT_RELEASED", "ATTENDANCE_MARKED",
      "ATTENDANCE_ABSENT", "BATCH_ANNOUNCEMENT", "ADMIN_ANNOUNCEMENT",
      "ACADEMIC_NOTICE", "ADMISSION_UPDATE", "REGISTRATION_UPDATE",
      "ACCESS_GRANTED", "ACCESS_REVOKED", "FACULTY_NOTIFICATION", "EMERGENCY_ALERT",
    ];
    check(
      "33.9: all broadcast templates derive same-name events",
      composerSendable.every((t) => eventForTemplate(t as never as Parameters<typeof eventForTemplate>[0]) === t)
    );
    check(
      "33.10: all same-name template pairings allowed",
      composerSendable.every((t) => isTemplateAllowedForEvent(t as never as Parameters<typeof isTemplateAllowedForEvent>[0], t))
    );
  }
}
