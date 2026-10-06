// Phase 5 — Attempts API.
// STUDENT: own attempts only (?testId= optional). ADMIN: all (+ filters).
// FACULTY: attempts for permitted tests (own created / assigned batches).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { facultyBatchIds, resolveStudent } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAttempt(r: any) {
  return {
    id: String(r.id),
    testId: String(r.testId),
    studentId: String(r.studentId),
    status: String(r.status),
    score: typeof r.score === "number" ? r.score : 0,
  };
}

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Reading attempts");
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  const testId = new URL(req.url).searchParams.get("testId");
  try {
    if (viewer.role === "STUDENT") {
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      if (!profile) return ok({ items: [], source: "database" });
      const rows = await db.testAttempt.findMany({
        where: { studentId: profile.id, ...(testId ? { testId } : {}) },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return ok({ items: rows.map(toAttempt), source: "database" });
    }
    if (viewer.role === "FACULTY") {
      const batchIds = await facultyBatchIds(db, viewer.id);
      const rows = await db.testAttempt.findMany({
        where: {
          ...(testId ? { testId } : {}),
          test: { OR: [{ createdById: viewer.id }, ...(batchIds.length > 0 ? [{ batchId: { in: batchIds } }] : [])] },
        },
        include: { student: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      return ok({ items: rows.map(toAttempt), source: "database" });
    }
    if (viewer.role !== "ADMIN") return fail("Forbidden.", 403);
    const params = new URL(req.url).searchParams;
    const studentId = params.get("studentId");
    const rows = await db.testAttempt.findMany({
      where: { ...(testId ? { testId } : {}), ...(studentId ? { studentId } : {}) },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return ok({ items: rows.map(toAttempt), source: "database" });
  } catch (err) {
    return serverError("attempts:list", err);
  }
}
