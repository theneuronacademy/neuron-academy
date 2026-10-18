// Faculty Assignments API - Homework/Assignment management
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading assignments");

  try {
    const params = new URL(req.url).searchParams;
    const batchId = params.get("batchId");

    let where: Record<string, unknown> = {};

    if (auth.user.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (batchId) {
        if (!allowed.includes(batchId)) return fail("Forbidden: batch not assigned to you.", 403);
        where.batchId = batchId;
      } else {
        where.batchId = { in: allowed.length ? allowed : ["__none__"] };
      }
    } else if (batchId) {
      where.batchId = batchId;
    }

    const assignments = await db.assignment.findMany({
      where,
      include: {
        batch: { select: { id: true, name: true } },
        test: { select: { id: true, title: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });

    return ok({ items: assignments, source: "database" });
  } catch (err) {
    return serverError("assignments:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating assignment");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const missing = missingFields(body, ["title", "batchId", "dueDate", "maxMarks", "weight"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);

  const { title, description, batchId, testId, dueDate, maxMarks, weight, status = "DRAFT" } = body;

  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return fail(`Invalid status. Must be one of: ${STATUSES.join(", ")}`, 400);
  }

  // Verify faculty access to batch
  if (auth.user.role === "FACULTY") {
    const allowed = await facultyBatchIds(db, auth.user.id);
    if (!allowed.includes(String(batchId))) return fail("Forbidden: batch not assigned to you.", 403);
  }

  // Verify batch exists
  const batch = await db.batch.findUnique({ where: { id: String(batchId) }, select: { id: true } });
  if (!batch) return fail("Batch not found.", 404);

  // Verify test exists if provided
  if (testId) {
    const test = await db.test.findUnique({ where: { id: String(testId) }, select: { id: true, batchId: true } });
    if (!test || test.batchId !== batchId) return fail("Test not found in this batch.", 404);
  }

  try {
    const assignment = await db.assignment.create({
      data: {
        title: String(title),
        description: description ? String(description) : null,
        batchId: String(batchId),
        testId: testId ? String(testId) : null,
        dueDate: new Date(String(dueDate)),
        maxMarks: Number(maxMarks),
        weight: Number(weight),
        status: status as (typeof STATUSES)[number],
      },
      include: {
        batch: { select: { id: true, name: true } },
        test: { select: { id: true, title: true } },
      },
    });

    return ok({ item: assignment }, 201);
  } catch (err) {
    return serverError("assignments:create", err);
  }
}