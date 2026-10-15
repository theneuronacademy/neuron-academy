// Test leaderboard — REAL server-computed ranks (no invented numbers).
// GET /api/tests/[id]/leaderboard
// STUDENT: only tests they can access (same gate as detail; locked tests
//   stay hidden as 404/403 via the central decision — no probing).
// FACULTY: only own/assigned-batch tests (same scope as detail).
// ADMIN: any test.
// Entries are ordered by percentage DESC, earlier finish (updatedAt) first.
// Standard competition ranking ("1224"): tied scores share a rank.
// Names only — no student IDs, emails, or other PII leave this endpoint.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import {
  batchAllowed,
  canStudentAccessTest,
  facultyMayManageTest,
  resolveStudent,
  STUDENT_VISIBLE_STATUSES,
} from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: testId } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading leaderboard");
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  try {
    const test = await db.test.findUnique({
      where: { id: testId },
      select: { id: true, title: true, totalMarks: true, status: true, accessType: true, batchId: true, isActive: true },
    });
    if (!test) return fail("Test not found.", 404);

    let myStudentId: string | null = null;
    if (viewer.role === "STUDENT") {
      if (!STUDENT_VISIBLE_STATUSES.includes(test.status as (typeof STUDENT_VISIBLE_STATUSES)[number])) {
        return fail("Test not found.", 404);
      }
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      const freeBypass = !!profile && profile.studentType === "SCHOLARSHIP" && test.accessType === "FREE";
      if (!profile || profile.status !== "ACTIVE" || (!freeBypass && !batchAllowed(profile.batchId, test.batchId))) {
        return fail("Test not found.", 404);
      }
      const decision = await canStudentAccessTest(db, profile.id, testId);
      if (!decision.allowed) return fail(decision.reason, decision.http);
      myStudentId = profile.id;
    } else if (viewer.role === "FACULTY") {
      if (!(await facultyMayManageTest(db, viewer.id, testId))) {
        return fail("Test not found.", 404);
      }
    } else if (viewer.role !== "ADMIN") {
      return fail("Forbidden.", 403);
    }

    const rows = await db.result.findMany({
      where: { testId },
      select: {
        studentId: true,
        marks: true,
        totalMarks: true,
        percentage: true,
        updatedAt: true,
        student: { select: { id: true, name: true } },
      },
      orderBy: [{ percentage: "desc" }, { updatedAt: "asc" }],
      take: 200,
    });

    // Standard competition ranking: equal percentages share a rank.
    let lastPct: number | null = null;
    let lastRank = 0;
    const entries = rows.map((r, i) => {
      const rank = lastPct !== null && r.percentage === lastPct ? lastRank : i + 1;
      lastPct = r.percentage;
      lastRank = rank;
      return {
        rank,
        name: r.student.name,
        percentage: r.percentage,
        marks: r.marks,
        totalMarks: r.totalMarks,
        isMe: myStudentId !== null && r.studentId === myStudentId,
      };
    });
    const myRank = myStudentId ? (entries.find((e) => e.isMe)?.rank ?? null) : null;

    return ok({
      test: { id: test.id, title: test.title, totalMarks: test.totalMarks },
      entries: entries.slice(0, 100),
      myRank,
      total: entries.length,
      source: "database",
    });
  } catch (err) {
    return serverError("tests:leaderboard", err);
  }
}
