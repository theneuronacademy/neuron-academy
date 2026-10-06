// Phase 14 — own class-test marks (REGULAR students only, read-only).
// Groups: class tests (batched, non-scholarship) / scholarship (unbatched
// FREE) / other (paid/private/offline). Only rows the student owns.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { getScopedStudent, requireRegular } from "@/lib/studentScope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT") return fail("Forbidden.", 403);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading marks");
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    const denied = requireRegular(scoped);
    if (denied || !scoped) return fail(denied?.error ?? "Student profile not found.", denied?.status ?? 403);

    const rows = await db.result.findMany({
      where: { studentId: scoped.id },
      select: {
        id: true,
        marks: true,
        totalMarks: true,
        percentage: true,
        attempted: true,
        correct: true,
        wrong: true,
        unanswered: true,
        status: true,
        createdAt: true,
        test: { select: { id: true, title: true, batchId: true, accessType: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const shaped = rows.map((r) => ({
      id: r.id,
      testId: r.test.id,
      testTitle: r.test.title,
      batchId: r.test.batchId,
      accessType: r.test.accessType,
      type: r.test.type,
      marks: r.marks,
      totalMarks: r.totalMarks,
      percentage: r.percentage,
      correct: r.correct,
      wrong: r.wrong,
      unanswered: r.unanswered,
      status: r.status,
      date: r.createdAt,
    }));
    const isScholarship = (r: (typeof shaped)[number]) =>
      r.batchId === null && r.accessType === "FREE";
    const isClass = (r: (typeof shaped)[number]) => r.batchId !== null && r.accessType === "FREE";
    return ok({
      classTests: shaped.filter(isClass),
      scholarshipTests: shaped.filter(isScholarship),
      otherTests: shaped.filter((r) => !isClass(r) && !isScholarship(r)),
    });
  } catch (err) {
    return serverError("students:marks", err);
  }
}
