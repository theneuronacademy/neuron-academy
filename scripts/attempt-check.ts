// Attempt resume regression checks.
// Run: npm run attempt:check
// No database, no network, no new packages. Exercises the REAL pure helpers
// (lib/attemptResume) plus static assertions over the attempt UI and APIs.
// Exits non-zero on failure.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deadlineFromRemaining,
  hydrateAnswers,
  isAttemptExpired,
  remainingSeconds,
  sanitizeAutosaveAnswers,
} from "../lib/attemptResume";

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

// 1. saved answers hydrate; garbage never becomes an answer.
{
  const h = hydrateAnswers({ q1: "B", q2: null, q3: "Z", q4: 42, q5: "e" });
  check("hydrate keeps valid display letters", h.q1 === "B" && !("q2" in h));
  check("hydrate drops out-of-range and non-strings", !("q3" in h) && !("q4" in h) && !("q5" in h));
  check("hydrate rejects non-objects", Object.keys(hydrateAnswers(null)).length === 0 && Object.keys(hydrateAnswers([["q1", "A"]])).length === 0 && Object.keys(hydrateAnswers("B")).length === 0);
}

// 2. remaining time comes from the server clock, never restarts on refresh.
{
  const start = "2026-10-09T10:00:00.000Z";
  const first = remainingSeconds({ startedAt: start, durationMin: 60, serverNow: "2026-10-09T10:20:00.000Z" });
  check("remaining is duration minus server elapsed", first === 2400);
  const refresh = remainingSeconds({ startedAt: start, durationMin: 60, serverNow: "2026-10-09T10:45:00.000Z" });
  check("refresh recomputes smaller remaining (no reset)", refresh !== null && first !== null && refresh < first && refresh === 900);
  check("exact expiry is expired", remainingSeconds({ startedAt: start, durationMin: 60, serverNow: "2026-10-09T11:00:00.000Z" }) === 0);
  check("past deadline stays negative", (remainingSeconds({ startedAt: start, durationMin: 60, serverNow: "2026-10-09T11:05:00.000Z" }) ?? 0) < 0);
  check("unusable inputs fail closed (null)", remainingSeconds({ startedAt: null, durationMin: 60, serverNow: start }) === null && remainingSeconds({ startedAt: start, durationMin: 0, serverNow: start }) === null && remainingSeconds({ startedAt: "nope", durationMin: 60, serverNow: start }) === null);
}

// 3. expiry gate.
{
  check("null/zero/negative are expired", isAttemptExpired(null) && isAttemptExpired(0) && isAttemptExpired(-5));
  check("positive remaining may continue", !isAttemptExpired(1));
}

// 4. deadline helper matches remaining time.
{
  const before = Date.now();
  const d = deadlineFromRemaining(300);
  check("deadline is now + remaining", d >= before + 300 * 1000 && d <= Date.now() + 300 * 1000);
}

// 5. client derives deadline from server values (no local reset).
{
  const ui = read("components/student/DbAttempt.tsx");
  check("deadline comes from serverNow + startedAt", ui.includes("serverNow") && ui.includes("attempt.startedAt") && ui.includes("deadlineRef"));
  check("no local-clock reset on begin", !ui.includes("startRef.current = Date.now()"));
  check("stale-closure timer fixed via refs", ui.includes("answersRef") && ui.includes("submitRef") && !ui.includes("exhaustive-deps"));
}

// 6. resume restores answers and announces itself.
{
  const ui = read("components/student/DbAttempt.tsx");
  check("answers hydrated from server attempt", ui.includes("hydrateAnswers(attempt.answers)"));
  check("resumed attempts show a status banner", ui.includes('role="status"') && ui.includes("Resumed your in-progress attempt"));
  check("begin retries explicitly", ui.includes("Retry") && ui.includes("void begin()"));
}

// 7. expired attempts submit once instead of continuing.
{
  const ui = read("components/student/DbAttempt.tsx");
  check("expired resume auto-submits once", ui.includes("remain <= 0") && ui.includes("doSubmit({ attemptId: aid, answers: restored })"));
}

// 8. duplicate submissions cannot loop.
{
  const ui = read("components/student/DbAttempt.tsx");
  check("submit guard blocks re-entry", ui.includes("submittedRef.current = true") && ui.includes("if (submittedRef.current) return"));
  check("409 already-submitted goes to result", ui.includes("res.status === 409") && ui.includes("/result"));
}

// 9. server enforces ownership; client attempt IDs are never trusted alone.
{
  const submit = read("app/api/tests/[id]/submit/route.ts");
  check("submit verifies attempt ownership", submit.includes("attempt.studentId !== profile.id"));
  check("submit rejects non-IN_PROGRESS (409)", submit.includes('attempt.status !== "IN_PROGRESS"'));
  check("submit 404s unknown attempts", submit.includes("Attempt not found. Start the test first."));
  const questions = read("app/api/questions/route.ts");
  check("questions verify attempt ownership", questions.includes("attempt.studentId !== profile.id"));
  check("questions reject submitted attempts (409)", questions.includes("This attempt is already submitted."));
  const attempt = read("app/api/tests/[id]/attempt/route.ts");
  check("attempt reuses IN_PROGRESS + returns serverNow", attempt.includes('prior.status === "IN_PROGRESS"') && attempt.includes("serverNow"));
  check("attempt refuses submitted tests (409)", attempt.includes("You have already submitted this test."));
}

// 10. autosave payload validation (server never stores foreign/malformed answers).
{
  const qids = ["q1", "q2"];
  const good = sanitizeAutosaveAnswers(qids, { q1: "A", q2: null });
  check("autosave keeps valid letters + explicit nulls", good.clean.q1 === "A" && good.clean.q2 === null && good.rejected.length === 0);
  const bad = sanitizeAutosaveAnswers(qids, { q1: "Z", q2: 3, foreign: "A", q1x: "B" });
  check("autosave rejects foreign IDs + bad values", !("q1" in bad.clean) && !("q2" in bad.clean) && !("foreign" in bad.clean) && bad.rejected.includes("foreign") && bad.rejected.includes("q1"));
  check("autosave rejects non-objects", sanitizeAutosaveAnswers(qids, null).rejected.length === 0 && Object.keys(sanitizeAutosaveAnswers(qids, [1]).clean).length === 0);
  const many: Record<string, string> = {};
  for (let i = 0; i < 600; i++) many[`q${i}`] = "A";
  const capped = sanitizeAutosaveAnswers(Object.keys(many), many);
  check("autosave bounded per save", Object.keys(capped.clean).length <= 500);
}

// 11. autosave endpoint: auth, ownership, status, expiry, validation, locking.
{
  const route = read("app/api/tests/[id]/attempt/route.ts");
  check("autosave requires STUDENT role", route.includes("export async function PATCH") && route.includes('requireApiRole(req, ["STUDENT"])'));
  check("autosave verifies ownership + test binding", route.includes("attempt.testId !== testId || attempt.studentId !== profile.id"));
  check("autosave IN_PROGRESS only (409)", route.includes('attempt.status !== "IN_PROGRESS"'));
  check("autosave enforces server-side expiry (410)", route.includes("Time is over for this attempt") && route.includes("410"));
  check("autosave re-checks access + LIVE window", route.includes("canStudentAccessTest(db, profile.id, testId)") && route.includes("isLiveWindowOpen(test.type"));
  check("autosave validates against real question IDs", route.includes("sanitizeAutosaveAnswers(qids, body.answers)") && route.includes("Invalid answers rejected"));
  check("autosave uses optimistic locking (updatedAt)", route.includes("updateMany") && route.includes("updatedAt: base") && route.includes("ATTEMPT_STALE"));
  check("stale conflict returns server draft for rebase", route.includes("answers: current.answers") && route.includes("updatedAt: current.updatedAt"));
  check("autosave never writes scores", !/data:\s*\{[^}]*score/.test(route.slice(route.indexOf("export async function PATCH"))));
}

// 12. concurrent saves cannot silently overwrite newer answers.
{
  // Simulated: save A (base t0) then save B (base t0) — second must conflict.
  type Row = { answers: Record<string, string | null>; updatedAt: number; status: string };
  const store = new Map<string, Row>([["a1", { answers: {}, updatedAt: 100, status: "IN_PROGRESS" }]]);
  const guardedSave = (id: string, base: number | null, clean: Record<string, string | null>): { ok: boolean; code?: string } => {
    const row = store.get(id);
    if (!row || row.status !== "IN_PROGRESS") return { ok: false, code: "GONE" };
    if (base !== null && row.updatedAt !== base) return { ok: false, code: "ATTEMPT_STALE" };
    store.set(id, { answers: clean, updatedAt: row.updatedAt + 1, status: row.status });
    return { ok: true };
  };
  const first = guardedSave("a1", 100, { q1: "A" });
  const second = guardedSave("a1", 100, { q1: "B" });
  check("first write wins, stale second conflicts", first.ok === true && second.ok === false && second.code === "ATTEMPT_STALE");
  check("loser data never overwrote winner", (store.get("a1")?.answers as Record<string, string>).q1 === "A");
  const rebased = guardedSave("a1", 101, { q1: "B" });
  check("rebase with fresh clock succeeds", rebased.ok === true);
}

// 13. client autosave behavior: debounce, states, flush, rebase, no loops.
{
  const ui = read("components/student/DbAttempt.tsx");
  check("saves debounced (1200ms)", ui.includes("1200") && ui.includes("saveTimerRef"));
  check("save states shown (saving/saved/failed)", ui.includes("Saving…") && ui.includes("All answers saved") && ui.includes("Save failed — kept locally"));
  check("failed saves keep local answers + retry", ui.includes("Retry save") && ui.includes("dirtyRef"));
  check("submit flushes pending saves first", ui.includes("saveNow({ force: true, redirectOnExpiry: false })"));
  check("stale conflict rebases dirty answers once", ui.includes("ATTEMPT_STALE") && ui.includes("rebased: true"));
  check("no autosave retry loops", !/setInterval\(\(\) => \{\s*void saveNow/.test(ui));
}

// 14. refresh recovery + submission races end-to-end (static contract).
{
  const ui = read("components/student/DbAttempt.tsx");
  check("base clock captured at begin", ui.includes("baseUpdatedAtRef.current ="));
  check("timer expiry submits via ref (no stale answers)", ui.includes("submitRef.current()"));
  check("expired save defers to submit (no recursion)", ui.includes("redirectOnExpiry"));
  check("submission still uses server-authoritative rules", ui.includes("/submit"));
}

console.log(`attempt-check: ${pass} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
