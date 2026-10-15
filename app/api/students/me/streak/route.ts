// Own practice streak + XP (STUDENT, both types — derived from attempts,
// so scholarship students are included; attendance contributes when present).
// XP formula (documented, server-side ONLY — the client never computes or
// submits XP, so it cannot be forged):
//   XP = round(total marks earned across own results) + 5 × present days.
// Streak = consecutive active days (a day counts with ≥1 submitted attempt
// or ≥1 PRESENT/LATE attendance). Missing today is fine if yesterday is
// active; the streak breaks only after a fully missed calendar day.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { getScopedStudent } from "@/lib/studentScope";

export const dynamic = "force-dynamic";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT") return fail("Forbidden.", 403);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading streak");
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    if (!scoped) return fail("Student profile not found.", 403);

    const [attempts, attendance, results] = await Promise.all([
      db.testAttempt.findMany({
        where: { studentId: scoped.id, status: { in: ["SUBMITTED", "EVALUATED"] } },
        select: { submittedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.attendance.findMany({
        where: { studentId: scoped.id },
        select: { date: true, status: true },
        orderBy: { date: "desc" },
        take: 1000,
      }),
      db.result.findMany({
        where: { studentId: scoped.id },
        select: { marks: true },
        take: 500,
      }),
    ]);

    const active = new Set<string>();
    for (const a of attempts) active.add(dayKey(a.submittedAt ?? a.createdAt));
    let presentDays = 0;
    for (const r of attendance) {
      if (r.status === "PRESENT" || r.status === "LATE") {
        presentDays += 1;
        active.add(dayKey(new Date(r.date)));
      }
    }

    const days = [...active].sort().reverse(); // newest first
    const today = dayKey(new Date());
    const yesterday = dayKey(new Date(Date.now() - 24 * 3600 * 1000));

    let currentStreak = 0;
    if (days.length > 0 && (days[0] === today || days[0] === yesterday)) {
      currentStreak = 1;
      for (let i = 1; i < days.length; i += 1) {
        const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime();
        const cur = new Date(`${days[i]}T00:00:00Z`).getTime();
        if (prev - cur === 24 * 3600 * 1000) currentStreak += 1;
        else break;
      }
    }

    let longestStreak = 0;
    let run = 0;
    const asc = [...active].sort();
    for (let i = 0; i < asc.length; i += 1) {
      if (i === 0) run = 1;
      else {
        const prev = new Date(`${asc[i - 1]}T00:00:00Z`).getTime();
        const cur = new Date(`${asc[i]}T00:00:00Z`).getTime();
        run = cur - prev === 24 * 3600 * 1000 ? run + 1 : 1;
      }
      if (run > longestStreak) longestStreak = run;
    }

    const marksTotal = results.reduce((s, r) => s + (Number(r.marks) || 0), 0);
    const xp = Math.round(marksTotal) + presentDays * 5;

    return ok({
      currentStreak,
      longestStreak,
      totalActiveDays: active.size,
      testsCompleted: attempts.length,
      presentDays,
      xp,
      source: "database",
    });
  } catch (err) {
    return serverError("students:streak", err);
  }
}
