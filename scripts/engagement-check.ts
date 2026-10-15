// Student/faculty engagement regression checks.
// Run: npm run engagement:check
// No database, no network, no new packages. Static wiring assertions over
// the leaderboard, streak, bookmarks, timetable, doubts, materials,
// homework, report, PWA and Hindi additions. Exits non-zero on failure.

import { readFileSync, existsSync } from "node:fs";
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

// ---------------------------------------------------------------------------
// 1. Leaderboard — real ranks, scoped, no PII leak (static)
// ---------------------------------------------------------------------------
{
  const lb = read("app/api/tests/[id]/leaderboard/route.ts");
  check("leaderboard gates students centrally", lb.includes("canStudentAccessTest"));
  check("leaderboard scopes faculty", lb.includes("facultyMayManageTest"));
  check("leaderboard ranks by percentage", lb.includes("percentage") && lb.includes("desc"));
  check("leaderboard ties share rank", lb.includes("lastPct") || lb.includes("tie"));
  check("leaderboard exposes names only", lb.includes("name: r.student.name") && !lb.includes("email: true") && !lb.includes("phone: true"));
  check("leaderboard needs auth", lb.includes("Not authenticated"));
  check("results route still null-rank", read("app/api/results/route.ts").includes("rank ?? null"));
}

// ---------------------------------------------------------------------------
// 2. Review explanations post-submit only (static)
// ---------------------------------------------------------------------------
{
  const rev = read("app/api/tests/[id]/review/route.ts");
  check("review returns explanation", rev.includes("explanation"));
  check("review still requires submitted attempt", rev.includes("SUBMITTED"));
  check("review still gates access", rev.includes("canStudentAccessTest"));
}

// ---------------------------------------------------------------------------
// 3. Streak/XP server-derived (static)
// ---------------------------------------------------------------------------
{
  const st = read("app/api/students/me/streak/route.ts");
  check("streak student-scoped", st.includes("getScopedStudent"));
  check("streak counts submitted attempts", st.includes("SUBMITTED"));
  check("streak formula documented", st.includes("XP =") || st.includes("XP="));
  check("streak never trusts client xp", !st.includes("body.xp") && !st.includes("input.xp"));
}

// ---------------------------------------------------------------------------
// 4. Bookmarks owned + cross-test forgery blocked (static)
// ---------------------------------------------------------------------------
{
  const bm = read("app/api/bookmarks/route.ts");
  check("bookmarks student-only", bm.includes('"STUDENT"'));
  check("bookmarks verify question in test", bm.includes("testId") && bm.includes("questionId"));
  check("bookmarks delete scoped", bm.includes("studentId: scoped.id"));
}

// ---------------------------------------------------------------------------
// 5. Faculty messaging scoped to own batches (static)
// ---------------------------------------------------------------------------
{
  const an = read("app/api/faculty/announcements/route.ts");
  check("announcements faculty-only", an.includes('"FACULTY"'));
  check("announcements verify batch", an.includes("facultyBatchIds"));
  check("announcements use engine", an.includes("dispatchNotification"));
}

// ---------------------------------------------------------------------------
// 6. Item analysis from attempt evidence (static)
// ---------------------------------------------------------------------------
{
  const ia = read("app/api/faculty/tests/[id]/analysis/route.ts");
  check("analysis faculty-scoped", ia.includes("facultyMayManageTest"));
  check("analysis reads submitted attempts", ia.includes("SUBMITTED"));
  check("analysis skips subjective honestly", ia.includes("evaluable"));
}

// ---------------------------------------------------------------------------
// 7. 360° profile scoped (static)
// ---------------------------------------------------------------------------
{
  const s360 = read("app/api/faculty/students/[id]/route.ts");
  check("360 faculty-only", s360.includes('"FACULTY"'));
  check("360 batch-scoped", s360.includes("facultyBatchIds"));
  check("360 hides outsiders as 404", s360.includes("Student not found"));
}

// ---------------------------------------------------------------------------
// 8. Timetable/doubts/materials scoped (static)
// ---------------------------------------------------------------------------
{
  const tt = read("app/api/timetable/route.ts");
  check("timetable student sees own batch", tt.includes("profile.batchId"));
  check("timetable writes admin-only", tt.includes('"ADMIN"'));
  check("timetable validates time", tt.includes("HH:MM"));
  const db = read("app/api/doubts/route.ts");
  check("doubts student asks own", db.includes("resolveStudent"));
  check("doubts faculty batch-scoped", db.includes("facultyBatchIds"));
  const rp = read("app/api/doubts/[id]/replies/route.ts");
  check("replies snapshot author server-side", rp.includes("authorName"));
  check("replies block closed doubts", rp.includes("CLOSED"));
  const mt = read("app/api/materials/route.ts");
  check("materials writes admin-only", mt.includes('"ADMIN"'));
  check("materials validate url scheme", mt.includes("http(s)://"));
}

// ---------------------------------------------------------------------------
// 9. Homework stays PRACTICE+FREE+batch (static)
// ---------------------------------------------------------------------------
{
  const tr = read("app/api/tests/route.ts");
  check("homework forces practice", tr.includes("isHomework"));
  check("homework needs batch for faculty", tr.includes("Homework needs an assigned batch"));
  check("faculty still cannot set price", tr.includes("Only admins can set test access type or price"));
}

// ---------------------------------------------------------------------------
// 10. UI wiring (static)
// ---------------------------------------------------------------------------
{
  const dash = read("app/student/dashboard/page.tsx");
  check("dashboard shows streak", dash.includes("/api/students/me/streak"));
  check("dashboard shows toppers", dash.includes("/api/showcase"));
  check("dashboard resume banner", dash.includes("CONTINUE WHERE YOU LEFT OFF"));
  const tests = read("app/student/tests/page.tsx");
  check("tests homework strip", tests.includes("Homework Due"));
  check("tests live countdown", tests.includes("LiveCountdown"));
  check("tests leaderboard modal", tests.includes("/leaderboard"));
  const res = read("app/student/tests/[id]/result/page.tsx");
  check("result rank banner", res.includes("myRank"));
  check("result shows explanations", res.includes("explanation"));
  check("result bookmarks", res.includes("/api/bookmarks"));
  const att = read("components/student/DbAttempt.tsx");
  check("attempt focus mode", att.includes("requestFullscreen"));
  const fDash = read("app/faculty/dashboard/page.tsx");
  check("faculty one-tap attendance", fDash.includes("TODAY"));
  check("faculty at-risk spotlight", fDash.includes("atRisk"));
  const fAtt = read("app/faculty/attendance/page.tsx");
  check("faculty bulk present", fAtt.includes("All Present"));
  const fRes = read("app/faculty/results/page.tsx");
  check("faculty histogram", fRes.includes("histogram"));
  check("faculty analysis section", fRes.includes("/analysis"));
  check("heatmap component exists", existsSync(join(ROOT, "components/analytics/AttendanceHeatmap.tsx")));
  check("student attendance uses heatmap", read("app/student/attendance/page.tsx").includes("AttendanceHeatmap"));
}

// ---------------------------------------------------------------------------
// 11. Shells, PWA, Hindi (static)
// ---------------------------------------------------------------------------
{
  const shell = read("components/student/StudentShell.tsx");
  check("student nav has timetable", shell.includes("/student/timetable"));
  check("student nav has doubts", shell.includes("/student/doubts"));
  check("student nav has revision", shell.includes("/student/revision"));
  check("student shell has lang toggle", shell.includes("LangToggle"));
  const fshell = read("components/faculty/FacultyShell.tsx");
  check("faculty nav has timetable", fshell.includes("/faculty/timetable"));
  check("faculty nav has doubts", fshell.includes("/faculty/doubts"));
  check("i18n falls back to english", read("lib/i18n.tsx").includes("?? STRINGS.en[k]"));
  check("manifest exists", existsSync(join(ROOT, "public/manifest.webmanifest")));
  check("icon exists", existsSync(join(ROOT, "public/icon.svg")));
  check("sw exists and never caches api", read("public/sw.js").includes("/api/") && read("public/sw.js").includes("network-only"));
  check("offline page exists", existsSync(join(ROOT, "app/offline/page.tsx")));
}

// ---------------------------------------------------------------------------
// 12. Migration authored, additive only (static)
// ---------------------------------------------------------------------------
{
  const mig = "prisma/migrations/20261014000001_engagement/migration.sql";
  check("engagement migration exists", existsSync(join(ROOT, mig)));
  const sql = read(mig);
  check("migration creates bookmarks", sql.includes('CREATE TABLE "Bookmark"'));
  check("migration creates timetable", sql.includes('CREATE TABLE "TimetableEntry"'));
  check("migration creates doubts", sql.includes('CREATE TABLE "Doubt"'));
  check("migration creates materials", sql.includes('CREATE TABLE "Material"'));
  check("migration adds homework flag", sql.includes("isHomework"));
  check("migration drops nothing", !sql.includes("DROP TABLE") && !sql.includes("DROP COLUMN"));
  const schema = read("prisma/schema.prisma");
  check("schema has engagement models", schema.includes("model Bookmark") && schema.includes("model Doubt") && schema.includes("model Material") && schema.includes("model TimetableEntry"));
}

console.log(`engagement-check: ${pass} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
