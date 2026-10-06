// P0 security regression checks — no database, no network, no new packages.
// Run: npm run security:check
// Exercises the REAL server helpers (lib/session, lib/server-auth,
// lib/testAccess, lib/studentScope) plus static route-guard assertions.
// Never a parallel auth system: every behavioral check goes through the
// production code paths. Exits non-zero on the first failing group summary.

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import {
  createSessionToken,
  getUserFromRequest,
  isAuthConfigured,
  verifySessionToken,
} from "../lib/session";
import { requireApiRole, sanitizeUser } from "../lib/server-auth";
import { batchAllowed, decideAccess, isLiveWindowOpen } from "../lib/testAccess";
import type { AccessDecision } from "../lib/testAccess";
import {
  STUDENT_EDITABLE_FIELDS,
  STUDENT_PROTECTED_FIELDS,
  requireRegular,
  sanitizeStudent,
} from "../lib/studentScope";

const ROOT = process.cwd();
const savedSecret = process.env.SESSION_SECRET;
const TEST_SECRET = "p0-regression-test-secret-32-chars";

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

/** Minimal cookie jar shaped like NextRequest for requireApiRole/getUserFromRequest. */
function fakeReq(token?: string): NextRequest {
  return {
    cookies: {
      get: (name: string) => (name === "neuron_session" && token ? { value: token } : undefined),
    },
  } as unknown as NextRequest;
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

/** Extract the denial HTTP code from an access decision (null when allowed). */
function deniedHttp(res: AccessDecision): number | null {
  return res.allowed ? null : res.http;
}

/** Extract the denial status from a requireApiRole result (null when allowed). */
function deniedStatus(res: ReturnType<typeof requireApiRole>): number | null {
  return res.ok ? null : res.status;
}

/** Hand-sign a payload with the documented token format (for expiry/role cases). */
function handSign(payload: Record<string, unknown>, secret: string): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return body + "." + sig;
}

// ---------------------------------------------------------------- session ---
process.env.SESSION_SECRET = TEST_SECRET;

const adminToken = createSessionToken({ id: "u-admin", email: "a@example.com", name: "A", role: "ADMIN" });
check("session round-trip creates a token", typeof adminToken === "string" && adminToken.length > 0);
const adminBack = verifySessionToken(adminToken);
check(
  "session round-trip verifies id/email/role",
  adminBack !== null && adminBack.id === "u-admin" && adminBack.email === "a@example.com" && adminBack.role === "ADMIN"
);
check("garbage token rejected", verifySessionToken("not-a-token") === null);
check("missing token rejected", verifySessionToken(undefined) === null && verifySessionToken("") === null);
if (adminToken) {
  const parts = adminToken.split(".");
  const tampered = parts[0].slice(0, -1) + (parts[0].endsWith("A") ? "B" : "A") + "." + parts[1];
  check("tampered signature rejected", verifySessionToken(tampered) === null);
}
check(
  "expired token rejected",
  verifySessionToken(
    handSign({ id: "u1", email: "e@x.com", name: "N", role: "STUDENT", exp: Math.floor(Date.now() / 1000) - 60 }, TEST_SECRET)
  ) === null
);
check(
  "unknown role rejected",
  verifySessionToken(
    handSign(
      { id: "u1", email: "e@x.com", name: "N", role: "SUPERUSER", exp: Math.floor(Date.now() / 1000) + 3600 },
      TEST_SECRET
    )
  ) === null
);
check(
  "wrong-secret token rejected",
  verifySessionToken(
    handSign({ id: "u1", email: "e@x.com", name: "N", role: "ADMIN", exp: Math.floor(Date.now() / 1000) + 3600 }, "other-secret-xyz-1234")
  ) === null
);
check("cookie jar extracts session user", getUserFromRequest(fakeReq(adminToken ?? undefined))?.role === "ADMIN");
check("empty cookie jar yields no user", getUserFromRequest(fakeReq()) === null);

// ------------------------------------------------------- requireApiRole ---
const studentToken =
  createSessionToken({ id: "u-stu", email: "s@example.com", name: "S", role: "STUDENT" }) ?? "";
const facultyToken =
  createSessionToken({ id: "u-fac", email: "f@example.com", name: "F", role: "FACULTY" }) ?? "";
check("wrong role STUDENT on ADMIN-only is 403", deniedStatus(requireApiRole(fakeReq(studentToken), ["ADMIN"])) === 403);
check("wrong role FACULTY on ADMIN-only is 403", deniedStatus(requireApiRole(fakeReq(facultyToken), ["ADMIN"])) === 403);
const adminOk = requireApiRole(fakeReq(adminToken ?? undefined), ["ADMIN"]);
check("ADMIN on ADMIN-only succeeds", adminOk.ok === true);
check("STUDENT on STUDENT-allowed succeeds", requireApiRole(fakeReq(studentToken), ["STUDENT", "ADMIN"]).ok === true);
check("unauthenticated request is 401", deniedStatus(requireApiRole(fakeReq(), ["ADMIN"])) === 401);

// Missing / invalid SESSION_SECRET behaves as unconfigured (503, never trust).
delete process.env.SESSION_SECRET;
check("missing secret is not configured", isAuthConfigured() === false);
check("missing secret creates no token", createSessionToken({ id: "x", email: "x@x.com", name: "X", role: "ADMIN" }) === null);
check("missing secret verifies nothing", verifySessionToken(adminToken) === null);
check("missing secret API guard is 503", deniedStatus(requireApiRole(fakeReq(studentToken), ["ADMIN"])) === 503);
process.env.SESSION_SECRET = "short";
check("short secret is not configured", isAuthConfigured() === false);
check("short secret verifies nothing", verifySessionToken(adminToken) === null);
process.env.SESSION_SECRET = TEST_SECRET;
check("restored secret verifies again", verifySessionToken(adminToken)?.role === "ADMIN");

// ------------------------------------------------------------ decideAccess ---
const freeTest = { id: "t1", status: "PUBLISHED", isActive: true, batchId: "b1", accessType: "FREE", price: 0 };
const regular = { id: "s1", batchId: "b1", status: "ACTIVE", studentType: "REGULAR" as const };
const otherBatch = { id: "s2", batchId: "b2", status: "ACTIVE", studentType: "REGULAR" as const };
const scholar = { id: "s3", batchId: "b9", status: "ACTIVE", studentType: "SCHOLARSHIP" as const };
const paidTest = { id: "t2", status: "PUBLISHED", isActive: true, batchId: "b1", accessType: "PAID", price: 499 };
const privateTest = { id: "t3", status: "PUBLISHED", isActive: true, batchId: "b1", accessType: "PRIVATE", price: 0 };
const grant = { id: "g1", status: "ACTIVE", expiresAt: null };
const d1 = decideAccess(regular, freeTest, null);
check("FREE same-batch allowed via FREE", d1.allowed === true);
check("DRAFT hidden as 404", deniedHttp(decideAccess(regular, { ...freeTest, status: "DRAFT" }, null)) === 404);
check("inactive test hidden as 404", deniedHttp(decideAccess(regular, { ...freeTest, isActive: false }, null)) === 404);
check("missing test is 404", deniedHttp(decideAccess(regular, null, null)) === 404);
check(
  "inactive student denied 403",
  deniedHttp(decideAccess({ ...regular, status: "INACTIVE" }, freeTest, null)) === 403
);
const locked = decideAccess(regular, paidTest, null);
check("PAID without grant locked 403 (grant isolation)", locked.allowed === false && deniedHttp(locked) === 403);
const hidden = decideAccess(regular, privateTest, null);
check("PRIVATE without grant hidden 404", hidden.allowed === false && deniedHttp(hidden) === 404);
const viaGrant = decideAccess(regular, paidTest, grant);
check("PAID with ACTIVE grant allowed", viaGrant.allowed === true);
check(
  "REVOKED grant denied 403",
  deniedHttp(decideAccess(regular, paidTest, { ...grant, status: "REVOKED" })) === 403
);
check(
  "expired grant denied 410",
  deniedHttp(decideAccess(regular, paidTest, { ...grant, expiresAt: new Date(Date.now() - 1000) })) === 410
);
check(
  "SCHOLARSHIP bypasses batch for FREE",
  decideAccess(scholar, { ...freeTest, batchId: "other" }, null).allowed === true
);
check("REGULAR cross-batch hidden 404", deniedHttp(decideAccess(otherBatch, freeTest, null)) === 404);
check(
  "SCHOLARSHIP bypass is FREE-only (PAID still locked)",
  decideAccess(scholar, { ...paidTest, batchId: "other" }, null).allowed === false
);

// --------------------------------------------------------------- studentScope ---
check("SCHOLARSHIP blocked from regular-only (403)", requireRegular({ ...scholar, userId: "u", name: "S" })?.status === 403);
check(
  "REGULAR allowed into regular-only",
  requireRegular({ id: "s1", userId: "u", batchId: "b1", status: "ACTIVE", studentType: "REGULAR", name: "R" }) === null
);
check("inactive blocked from regular-only", requireRegular({ ...scholar, userId: "u", name: "S", status: "INACTIVE" })?.status === 403);
check("missing profile blocked", requireRegular(null)?.status === 403);
const overlap = STUDENT_PROTECTED_FIELDS.filter((f) =>
  (STUDENT_EDITABLE_FIELDS as readonly string[]).includes(f)
);
check("protected fields never editable (studentType/status/batchId/email)", overlap.length === 0);
check(
  "sanitizeStudent strips nested hashes",
  (() => {
    const out = sanitizeStudent({ id: "s", user: { passwordHash: "x", dobHash: "y", email: "e" } });
    const u = out.user as Record<string, unknown>;
    return u.passwordHash === undefined && u.dobHash === undefined && u.email === "e";
  })()
);
check(
  "sanitizeUser strips top-level hashes",
  (() => {
    const out = sanitizeUser({ id: "u", passwordHash: "x", dobHash: "y", email: "e" });
    return !("passwordHash" in out) && !("dobHash" in out);
  })()
);

// ------------------------------------------------------------------ misc pure ---
check("open test (no batch) allowed for any batch", batchAllowed("b1", null) === true);
check("same batch allowed", batchAllowed("b1", "b1") === true);
check("different batch denied", batchAllowed("b2", "b1") === false);
check("batchless student denied from batched test", batchAllowed(null, "b1") === false);
check("OFFLINE never opens online", isLiveWindowOpen("OFFLINE", "LIVE", null, null).open === false);
check(
  "unpublished PRACTICE closed",
  isLiveWindowOpen("PRACTICE", "DRAFT", null, null).open === false
);
check(
  "LIVE in window opens",
  isLiveWindowOpen("LIVE", "LIVE", new Date(Date.now() - 60000), new Date(Date.now() + 60000)).open === true
);
check(
  "ended LIVE closed",
  isLiveWindowOpen("LIVE", "LIVE", null, new Date(Date.now() - 1000)).open === false
);

// ------------------------------------------------------- static route guards ---
const testDetail = read("app/api/tests/[id]/route.ts");
check("tests/[id] rejects anonymous with 401", testDetail.includes('fail("Not authenticated.", 401)'));
const faculty = read("app/api/faculty/route.ts");
check("faculty list strips PII for non-admin", faculty.includes("toPublic") && faculty.includes('viewer?.role === "ADMIN"'));
const annHead = read("app/api/announcements/[id]/route.ts").split("export async function PATCH")[0];
const annFull = read("app/api/announcements/[id]/route.ts");
check("announcement detail GET is public (writes still ADMIN)", !annHead.includes("requireApiRole(req") && annFull.includes("requireApiRole"));
const results = read("app/api/results/route.ts");
check("results no-DB is honest 503", results.includes('dbNotConfigured("Reading results")') && !results.includes('source: "demo"'));
const questions = read("app/api/questions/route.ts");
check("questions no-DB is honest 503", questions.includes('dbNotConfigured("Reading questions")') && !questions.includes('source: "demo"'));
const access = read("app/api/test-access/route.ts");
check(
  "test-access denies FACULTY and scopes STUDENT to own grants",
  access.includes('viewer.role !== "ADMIN"') && access.includes("resolveStudent(db, viewer.id, viewer.email)")
);
const mw = read("middleware.ts");
check(
  "middleware fails closed in production without secret",
  mw.includes('process.env.NODE_ENV !== "production"') && mw.includes("secretValid")
);
check("middleware has no unconditional fail-open", !mw.includes("if (!secret || secret.length < 16) return NextResponse.next()"));

// ------------------------------------------- C1: server-only student attempt ---
const attemptPage = read("app/student/tests/[id]/page.tsx");
check("student attempt never loads BankQuestion rows", !attemptPage.includes("getQuestionById("));
check("student attempt never touches answer keys", !attemptPage.includes("correctAnswer"));
check("student attempt never evaluates locally", !attemptPage.includes("evaluateTest("));
check("student attempt has no localStorage draft state", !attemptPage.includes("draftKey("));
check("student attempt never uses local eligibility", !attemptPage.includes("getResultFor("));
check(
  "student attempt delegates to DbAttempt",
  attemptPage.includes("DbAttempt") && attemptPage.includes("<DbAttempt testId={id} />")
);

// ------------------------------------ C2: server-only student result flow ---
const resultPage = read("app/student/tests/[id]/result/page.tsx");
check("student result has no local fallback", !resultPage.includes("getResultFor(") && !resultPage.includes("getTestById("));
check("student result never evaluates locally", !resultPage.includes("evaluateTest("));
check("student result has no localStorage authority", !resultPage.includes("localStorage") && !resultPage.includes("draftKey("));
check("student review stays server-backed", resultPage.includes("/review") && resultPage.includes("/api/results?testId="));

// ----------------------------------- C3: server-driven student catalogue ---
const cataloguePage = read("app/student/tests/page.tsx");
check("student catalogue never reads local tests", !cataloguePage.includes("getTests("));
check("student catalogue never reads local results", !cataloguePage.includes("getResults("));
check("student catalogue never derives status locally", !cataloguePage.includes("deriveStatus("));
check("student catalogue never filters visibility locally", !cataloguePage.includes("visibleToStudents("));
check(
  "student catalogue is server-backed",
  cataloguePage.includes("/api/tests") && cataloguePage.includes("/api/results")
);

// ---------------------- C4: API-authoritative admin question management ---
const perTestQuestions = read("app/admin/tests/[id]/questions/page.tsx");
check(
  "per-test questions have no local CRUD branch",
  !perTestQuestions.includes("updateQuestion(") &&
    !perTestQuestions.includes("deleteQuestion(") &&
    !perTestQuestions.includes("bulkApprove(") &&
    !perTestQuestions.includes("bulkDelete(") &&
    !perTestQuestions.includes("getTestById(") &&
    !perTestQuestions.includes("filterQuestions(")
);
check(
  "per-test questions use DbQuestionsManager + question API",
  perTestQuestions.includes("DbQuestionsManager") && perTestQuestions.includes("/api/questions")
);
const bankPage = read("app/admin/question-bank/page.tsx");
check(
  "question bank has no local CRUD branch",
  !bankPage.includes("getQuestions(") &&
    !bankPage.includes("saveQuestion(") &&
    !bankPage.includes("updateQuestion(") &&
    !bankPage.includes("deleteQuestion(") &&
    !bankPage.includes("bulkApprove(") &&
    !bankPage.includes("bulkDelete(") &&
    !bankPage.includes("getTestById(") &&
    !bankPage.includes("filterQuestions(")
);
check("question bank uses question API", bankPage.includes("/api/questions"));
const qmap = read("services/dbQuestionMap.ts");
check(
  "question mapper preserves E option + subject + confidence",
  qmap.includes('"E"') && qmap.includes("optionE") && qmap.includes("r.subject") && qmap.includes("r.confidence")
);

// ------------------------------------------------------------------ summary ---
if (savedSecret === undefined) delete process.env.SESSION_SECRET;
else process.env.SESSION_SECRET = savedSecret;
console.log("security-check: " + pass + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
