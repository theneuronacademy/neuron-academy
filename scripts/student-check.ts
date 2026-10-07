// Phase 16 — student experience regression checks.
// Run: npm run student:check
// No database, no network, no new packages. Exercises the REAL server
// helpers (lib/testAccess, lib/studentScope, lib/evaluation) plus static
// route/page assertions over the student journey. Exits non-zero on failure.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { batchAllowed, decideAccess } from "../lib/testAccess";
import type { AccessDecision } from "../lib/testAccess";
import {
  STUDENT_EDITABLE_FIELDS,
  STUDENT_PROTECTED_FIELDS,
  requireRegular,
} from "../lib/studentScope";
import { evaluateAnswers, normalizeAnswer } from "../lib/evaluation";

const ROOT = process.cwd();

let pass = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) pass += 1;
  else {
    failed += 1;
    console.error("FAIL: " + name);
  }
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function deniedHttp(res: AccessDecision): number | null {
  return res.allowed ? null : res.http;
}

const freeTest = { id: "t-free", status: "PUBLISHED", isActive: true, batchId: "b1", accessType: "FREE", price: 0 };
const paidTest = { id: "t-paid", status: "PUBLISHED", isActive: true, batchId: "b1", accessType: "PAID", price: 499 };
const privateTest = { id: "t-priv", status: "PUBLISHED", isActive: true, batchId: "b1", accessType: "PRIVATE", price: 0 };
const draftTest = { id: "t-draft", status: "DRAFT", isActive: true, batchId: "b1", accessType: "FREE", price: 0 };
const regular = { id: "s-reg", batchId: "b1", status: "ACTIVE", studentType: "REGULAR" as const };
const scholar = { id: "s-sch", batchId: null, status: "ACTIVE", studentType: "SCHOLARSHIP" as const };
const scholarBatched = { id: "s-sch2", batchId: "b9", status: "ACTIVE", studentType: "SCHOLARSHIP" as const };
const inactive = { id: "s-ina", batchId: "b1", status: "INACTIVE", studentType: "REGULAR" as const };
const grant = { id: "g1", status: "ACTIVE", expiresAt: null };

// ------------------------------------------------- regular student access ---
check("regular sees own-batch FREE", decideAccess(regular, freeTest, null).allowed === true);
check("regular cross-batch hidden 404", deniedHttp(decideAccess({ ...regular, batchId: "b2" }, freeTest, null)) === 404);
check("inactive student denied 403", deniedHttp(decideAccess(inactive, freeTest, null)) === 403);
check("draft hidden as 404", deniedHttp(decideAccess(regular, draftTest, null)) === 404);

// ------------------------------------------------ scholarship access ---
check(
  "scholarship bypasses batch for FREE",
  decideAccess(scholar, { ...freeTest, batchId: "other" }, null).allowed === true
);
check(
  "scholarship FREE bypass is batch-independent (batched scholar)",
  decideAccess(scholarBatched, { ...freeTest, batchId: "other" }, null).allowed === true
);
check(
  "scholarship bypass is FREE-only (PAID still locked)",
  decideAccess(scholar, { ...paidTest, batchId: "other" }, null).allowed === false
);
check(
  "scholarship PRIVATE still hidden without grant",
  deniedHttp(decideAccess(scholar, { ...privateTest, batchId: "other" }, null)) === 404
);
check(
  "scholarship blocked from regular-only sections",
  requireRegular({ id: "s", userId: "u", batchId: null, status: "ACTIVE", studentType: "SCHOLARSHIP", name: "S" })?.status === 403
);
check(
  "regular allowed into regular-only sections",
  requireRegular({ id: "s", userId: "u", batchId: "b1", status: "ACTIVE", studentType: "REGULAR", name: "R" }) === null
);

// ------------------------------------------------- FREE / PAID / PRIVATE ---
check("FREE open without grant", decideAccess(regular, freeTest, null).allowed === true);
{
  const locked = decideAccess(regular, paidTest, null);
  check("PAID without grant locked 403", locked.allowed === false && deniedHttp(locked) === 403);
}
{
  const hidden = decideAccess(regular, privateTest, null);
  check("PRIVATE without grant hidden 404", hidden.allowed === false && deniedHttp(hidden) === 404);
}
check("PAID with ACTIVE grant allowed", decideAccess(regular, paidTest, grant).allowed === true);
check("PRIVATE with ACTIVE grant allowed", decideAccess(regular, privateTest, grant).allowed === true);
check("REVOKED grant denied 403", deniedHttp(decideAccess(regular, paidTest, { ...grant, status: "REVOKED" })) === 403);
check(
  "expired grant denied 410",
  deniedHttp(decideAccess(regular, paidTest, { ...grant, expiresAt: new Date(Date.now() - 1000) })) === 410
);
check("open test (no batch) allowed for any batch", batchAllowed("b1", null) === true);
check("batchless student denied from batched test", batchAllowed(null, "b1") === false);

// ----------------------------------------------- unauthorized test blocked ---
{
  const detail = read("app/api/tests/[id]/route.ts");
  const getBody = detail.slice(detail.indexOf("export async function GET"));
  check(
    "test detail authenticates before DB read (no anon oracle)",
    getBody.indexOf("getUserFromRequest(req)") !== -1 &&
      getBody.indexOf("getUserFromRequest(req)") < getBody.indexOf("findUnique")
  );
  check("test detail rejects anonymous with 401", detail.includes('fail("Not authenticated.", 401)'));
  check("test detail strips answer keys for students", detail.includes("safeQuestions") && !detail.match(/safeQuestions[\s\S]{0,600}correctAnswer/));
  const questions = read("app/api/questions/route.ts");
  check("question paper is answer-free", questions.includes("assemblePaper"));
  const attempt = read("app/api/tests/[id]/attempt/route.ts");
  check("attempt creation requires STUDENT role", attempt.includes('requireApiRole(req, ["STUDENT"])'));
  check("attempt enforces access gate", attempt.includes("canStudentAccessTest"));
  const submit = read("app/api/tests/[id]/submit/route.ts");
  check("submit binds attempt to caller", submit.includes("studentId") && submit.includes("profile.id"));
  check("submit re-checks access (revoke mid-attempt)", submit.includes("canStudentAccessTest"));
}

// ------------------------------------------------ answer key protection ---
check("normalizeAnswer accepts E (5-option tests)", normalizeAnswer("E") === "E" && normalizeAnswer(4) === "E");
check("normalizeAnswer still accepts A-D", normalizeAnswer("A") === "A" && normalizeAnswer("d") === "D");
{
  const review = read("app/api/tests/[id]/review/route.ts");
  check("review requires own submitted attempt", review.includes("studentId: profile.id") && review.includes('status: { in: ["SUBMITTED", "EVALUATED"] }'));
  check("review covers all five options", review.includes("q.optionE"));
  check("review re-checks access", review.includes("canStudentAccessTest"));
  const ev = evaluateAnswers(
    [
      { id: "q1", correctAnswer: "E", marks: 2, negativeMarks: 0.5 },
      { id: "q2", correctAnswer: "A", marks: 1, negativeMarks: 0 },
    ],
    { q1: "E", q2: "B" }
  );
  check("server scores 5-option answers", ev.correct === 1 && ev.wrong === 1 && ev.marks === 2 - 0);
}

// ------------------------------------------------- attempt ownership ---
{
  const attempt = read("app/api/tests/[id]/attempt/route.ts");
  check("attempt resolves server-side profile", attempt.includes("resolveStudent"));
  check("attempt rejects forged ownership (404)", attempt.includes("404"));
  const q = read("app/api/questions/route.ts");
  check("question fetch binds attempt to caller test+student", q.includes("attempt.testId !== testId") && q.includes("attempt.studentId !== profile.id"));
}

// -------------------------------------------------- result ownership ---
{
  const results = read("app/api/results/route.ts");
  check("student results ignore client studentId filter", results.includes("studentId: profile.id") && !results.includes("params.get(\"studentId\")") || results.includes("where: { studentId: profile.id"));
  check("results never invent rank", results.includes("rank ?? null"));
  const one = read("app/api/results/[id]/route.ts");
  check("single result checks ownership", one.includes("profile.id") && one.includes("row.studentId"));
  const resultPage = read("app/student/tests/[id]/result/page.tsx");
  check("result page is server-backed (no local authority)", !resultPage.includes("localStorage") && resultPage.includes("/api/results?testId="));
  const resultsPage = read("app/student/results/page.tsx");
  check("results index reads own API feed", resultsPage.includes('fetch("/api/results"'));
  check("results index has honest empty state", resultsPage.includes("No results yet"));
}

// ----------------------------------------------- attendance ownership ---
{
  const att = read("app/api/students/me/attendance/route.ts");
  check("attendance forces ownership", att.includes("studentId: scoped.id"));
  check("attendance is regular-only", att.includes("requireRegular"));
  check("attendance never exposes device internals", !att.includes("deviceId"));
  const page = read("app/student/attendance/page.tsx");
  check("attendance page handles scholarship 403", page.includes("403") && page.includes("regular students only"));
}

// --------------------------------------------------- marks ownership ---
{
  const marks = read("app/api/students/me/marks/route.ts");
  check("marks force ownership", marks.includes("studentId: scoped.id"));
  check("marks are regular-only", marks.includes("requireRegular"));
  check("marks are bounded", marks.includes("take:"));
}

// ------------------------------------------------ analytics ownership ---
{
  const analytics = read("app/api/students/me/analytics/route.ts");
  check("analytics forces ownership", analytics.includes("studentId: scoped.id"));
  check("analytics is regular-only", analytics.includes("requireRegular"));
  check("analytics invents no rank/percentile", !analytics.includes("rank") && !analytics.includes("percentile"));
  const page = read("app/student/analytics/page.tsx");
  check("analytics page has honest no-data state", page.includes("Not enough data yet"));
}

// ------------------------------------------------- profile allowlist ---
{
  const overlap = STUDENT_PROTECTED_FIELDS.filter((f) =>
    (STUDENT_EDITABLE_FIELDS as readonly string[]).includes(f)
  );
  check("protected fields never editable", overlap.length === 0);
  check("studentType is protected", (STUDENT_PROTECTED_FIELDS as readonly string[]).includes("studentType"));
  check("batchId is protected", (STUDENT_PROTECTED_FIELDS as readonly string[]).includes("batchId"));
  check("status is protected", (STUDENT_PROTECTED_FIELDS as readonly string[]).includes("status"));
  const profile = read("app/api/students/me/profile/route.ts");
  check("profile PATCH rejects protected fields with 403", profile.includes("STUDENT_PROTECTED_FIELDS") && profile.includes("403"));
  const photo = read("app/api/students/me/photo/route.ts");
  check("photo validates type/size/magic bytes", photo.includes("validatePhotoUpload"));
  check("photo regenerates server filename", photo.includes("saveUpload"));
}

// -------------------------------------------- notification ownership ---
{
  const mine = read("app/api/notifications/mine/route.ts");
  check("notification feed resolves profile server-side", mine.includes("resolveStudent(db, viewer.id, viewer.email)"));
  check("notification feed is SENT-only", mine.includes('"SENT"'));
  check("notification mark-read derives identity from session", mine.includes("viewer.id") && !mine.includes("body.studentId"));
  check("broadcast reads use per-user receipts", mine.includes("notificationRead"));
  check("shared flag only flips for individual rows", mine.includes("isIndividual"));
  const page = read("app/student/notifications/page.tsx");
  check("notifications page never grants localStorage authority", !page.includes("markNotificationRead"));
}

// ------------------------------------------ localStorage non-authority ---
{
  const storage = read("lib/storage.ts");
  check("no authoritative test state in localStorage", !storage.includes("neuron_tests") && !storage.includes("neuron_results") && !storage.includes("neuron_attempts"));
  const attemptPage = read("app/student/tests/[id]/page.tsx");
  check("attempt page has no localStorage draft", !attemptPage.includes("localStorage.") && !attemptPage.includes("draftKey("));
  const catalogue = read("app/student/tests/page.tsx");
  check("catalogue is server-driven", catalogue.includes("/api/tests") && !catalogue.includes("getTests("));
  const login = read("app/student/login/page.tsx");
  check("login session is a UX cache (server cookie authoritative)", login.includes("/api/auth/student/login"));
}

// ------------------------------------------------- books / batches ---
{
  const books = read("app/api/books/route.ts");
  check("books hide inactive", books.includes("isActive: true"));
  check("books scope scholarship server-side", books.includes('visibleTo: "ALL"'));
  const batches = read("app/api/students/me/batches/route.ts");
  check("batches feed is regular-only", batches.includes("requireRegular"));
  check("batches feed hides ungranted PRIVATE", batches.includes('!== "PRIVATE"'));
}

console.log(`student-check: ${pass} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
