// Phase 5 — Results API with role scoping.
// ADMIN: all (+ filters testId/studentId). FACULTY: permitted tests only.
// STUDENT: own results only — any studentId filter is ignored.
// No rank is invented: rank stays null unless explicitly set.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds, resolveStudent } from "@/lib/testAccess";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shape(r: any) {
  return {
    id: r.id,
    testId: r.testId,
    testTitle: r.test?.title ?? "",
    studentId: r.studentId,
    studentName: r.student?.name ?? "",
    marks: r.marks,
    totalMarks: r.totalMarks,
    percentage: r.percentage,
    rank: r.rank ?? null,
    status: r.status,
    attempted: r.attempted ?? 0,
    correct: r.correct ?? 0,
    wrong: r.wrong ?? 0,
    unanswered: r.unanswered ?? 0,
    date: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "",
  };
}

export async function GET(req: NextRequest) {
  // Auth first (even for demo responses) — marks are private.
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  const db = getDb();
  if (!db) return ok({ items: [], source: "demo", note: "Results live in lib/storage.ts until the API engine lands." });
  try {
    const params = new URL(req.url).searchParams;
    const testId = params.get("testId");
    if (viewer.role === "STUDENT") {
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      if (!profile) return ok({ items: [], source: "database" });
      const rows = await db.result.findMany({
        where: { studentId: profile.id, ...(testId ? { testId } : {}) },
        include: { student: true, test: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return ok({ items: rows.map(shape), source: "database" });
    }
    if (viewer.role === "FACULTY") {
      const batchIds = await facultyBatchIds(db, viewer.id);
      const rows = await db.result.findMany({
        where: {
          ...(testId ? { testId } : {}),
          test: { OR: [{ createdById: viewer.id }, ...(batchIds.length > 0 ? [{ batchId: { in: batchIds } }] : [])] },
        },
        include: { student: true, test: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      return ok({ items: rows.map(shape), source: "database" });
    }
    if (viewer.role !== "ADMIN") return fail("Forbidden.", 403);
    const studentId = params.get("studentId");
    const rows = await db.result.findMany({
      where: { ...(testId ? { testId } : {}), ...(studentId ? { studentId } : {}) },
      include: { student: true, test: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return ok({ items: rows.map(shape), source: "database" });
  } catch (err) {
    return serverError("results:list", err);
  }
}

export async function POST(req: NextRequest) {
  // Direct result upload (admin console). Offline marks use /api/results/offline.
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Uploading a result");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["studentId", "testId"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  try {
    const student = await db.student.findUnique({ where: { id: String(body.studentId) } });
    if (!student) return fail("Student not found.", 404);
    const test = await db.test.findUnique({ where: { id: String(body.testId) } });
    if (!test) return fail("Test not found.", 404);
    // Faculty may upload only for own/assigned-batch tests.
    if (auth.user.role === "FACULTY") {
      const allowed = test.createdById === auth.user.id || (test.batchId !== null && (await facultyBatchIds(db, auth.user.id)).includes(test.batchId));
      if (!allowed) return fail("You can upload results only for your own or assigned-batch tests.", 403);
    }
    const marks = typeof body.marks === "number" ? body.marks : 0;
    const totalMarks = typeof body.totalMarks === "number" ? body.totalMarks : test.totalMarks;
    if (marks < 0 || marks > totalMarks) return fail(`Marks must be between 0 and ${totalMarks}.`, 400);
    const percentage = totalMarks > 0 ? Math.round((marks / totalMarks) * 1000) / 10 : 0;
    const existing = await db.result.findFirst({ where: { studentId: student.id, testId: test.id } });
    const created = existing
      ? await db.result.update({ where: { id: existing.id }, data: { marks, totalMarks, percentage, status: "PUBLISHED" } })
      : await db.result.create({ data: { studentId: student.id, testId: test.id, marks, totalMarks, percentage, status: "PUBLISHED" } });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("results:create", err);
  }
}
