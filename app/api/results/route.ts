// Phase 5 — Results API with role scoping and cursor pagination.
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
    // Analytics fields
    timePerQuestion: r.timePerQuestion,
    topicBreakdown: r.topicBreakdown,
  };
}

export async function GET(req: NextRequest) {
  // Auth first (even for demo responses) — marks are private.
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  const db = getDb();
  // P0: marks are private — never answer from demo data; fail honestly
  // (503) when no database is configured, like attempts/books/public tests.
  if (!db) return dbNotConfigured("Reading results");
  try {
    const params = new URL(req.url).searchParams;
    const testId = params.get("testId");
    const cursor = params.get("cursor"); // ISO date string for cursor pagination
    const limit = Math.min(parseInt(params.get("limit") ?? "50"), 100);

    const whereBase: Record<string, unknown> = {};
    if (testId) whereBase.testId = testId;

    if (viewer.role === "STUDENT") {
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      if (!profile) return ok({ items: [], nextCursor: null, source: "database" });
      const where = { studentId: profile.id, ...whereBase };
      const rows = await db.result.findMany({
        where,
        include: { student: true, test: true },
        orderBy: { createdAt: "desc" },
        take: limit + 1, // fetch one extra to detect next page
        ...(cursor ? { cursor: { createdAt: new Date(cursor) }, skip: 1 } : {}),
      });
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;
      return ok({ items: items.map(shape), nextCursor, source: "database" });
    }
    if (viewer.role === "FACULTY") {
      const batchIds = await facultyBatchIds(db, viewer.id);
      const where = {
        ...whereBase,
        test: { OR: [{ createdById: viewer.id }, ...(batchIds.length > 0 ? [{ batchId: { in: batchIds } }] : [])] },
      };
      const rows = await db.result.findMany({
        where,
        include: { student: true, test: true },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { createdAt: new Date(cursor) }, skip: 1 } : {}),
      });
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;
      return ok({ items: items.map(shape), nextCursor, source: "database" });
    }
    if (viewer.role !== "ADMIN") return fail("Forbidden.", 403);
    const studentId = params.get("studentId");
    const where = { ...whereBase, ...(studentId ? { studentId } : {}) };
    const rows = await db.result.findMany({
      where,
      include: { student: true, test: true },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { createdAt: new Date(cursor) }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;
    return ok({ items: items.map(shape), nextCursor, source: "database" });
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
    // Faculty may upload only for own/assigned-batch tests, and only for
    // students in their scope (test creator → any student on that test;
    // batch-assigned faculty → students of their own batches).
    if (auth.user.role === "FACULTY") {
      if (test.createdById === auth.user.id) {
        // Own test — any student reachable through it is in scope.
      } else {
        const mine = await facultyBatchIds(db, auth.user.id);
        const testInScope = test.batchId !== null && mine.includes(test.batchId);
        const studentInScope = student.batchId !== null && mine.includes(student.batchId);
        if (!testInScope || !studentInScope) {
          return fail("You can upload results only for students in your assigned batches.", 403);
        }
      }
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
