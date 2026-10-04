// Phase 5 — Tests API.
// Visibility: ADMIN → all; FACULTY → created + assigned batches;
// STUDENT → published/live/scheduled/completed in own batch (drafts never).
// The localStorage engine (/admin/tests) is untouched; this is the
// PostgreSQL path the API-backed engine uses.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds, resolveStudent, STUDENT_VISIBLE_STATUSES } from "@/lib/testAccess";
import { isNonEmpty, missingFields, parseDate } from "@/lib/validation";
import { DEMO_TESTS } from "@/data/admin";

export const dynamic = "force-dynamic";

const TYPES = ["LIVE", "OFFLINE", "PRACTICE"] as const;
const STATUSES = ["DRAFT", "SCHEDULED", "LIVE", "COMPLETED", "PUBLISHED"] as const;

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return ok({ items: DEMO_TESTS, source: "demo" });
  const viewer = getUserFromRequest(req);
  try {
    // Public/anonymous: website-visible tests only (published + live).
    if (!viewer) {
      const rows = await db.test.findMany({
        where: { status: { in: ["PUBLISHED", "LIVE"] } },
        include: { batch: true, _count: { select: { questions: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return ok({ items: rows, source: "database" });
    }
    if (viewer.role === "ADMIN") {
      const rows = await db.test.findMany({ include: { batch: true, _count: { select: { questions: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
      return ok({ items: rows, source: "database" });
    }
    if (viewer.role === "FACULTY") {
      const batchIds = await facultyBatchIds(db, viewer.id);
      const rows = await db.test.findMany({
        where: { OR: [{ createdById: viewer.id }, ...(batchIds.length > 0 ? [{ batchId: { in: batchIds } }] : [])] },
        include: { batch: true, _count: { select: { questions: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return ok({ items: rows, source: "database" });
    }
    // STUDENT: own batch + visible statuses; drafts never appear.
    const profile = await resolveStudent(db, viewer.id, viewer.email);
    if (!profile || profile.status !== "ACTIVE") return ok({ items: [], source: "database" });
    const rows = await db.test.findMany({
      where: {
        status: { in: [...STUDENT_VISIBLE_STATUSES] },
        ...(profile.batchId ? { OR: [{ batchId: profile.batchId }, { batchId: null }] } : { batchId: null }),
      },
      include: { batch: true, _count: { select: { questions: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("tests:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating a test");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["title"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  // Faculty may create only for assigned batches (see lib/ownership.ts).
  if (auth.user.role === "FACULTY" && isNonEmpty(body.batchId)) {
    const allowed = await facultyBatchIds(db, auth.user.id);
    if (!allowed.includes(String(body.batchId))) return fail("You can create tests only for your assigned batches.", 403);
  }
  try {
    const created = await db.test.create({
      data: {
        title: String(body.title),
        description: typeof body.description === "string" ? body.description : undefined,
        batchId: isNonEmpty(body.batchId) ? String(body.batchId) : undefined,
        createdById: auth.user.id,
        type: TYPES.includes(body.type as (typeof TYPES)[number]) ? (body.type as (typeof TYPES)[number]) : "PRACTICE",
        duration: typeof body.duration === "number" ? body.duration : 60,
        totalMarks: typeof body.totalMarks === "number" ? body.totalMarks : 0,
        startTime: parseDate(body.startTime),
        endTime: parseDate(body.endTime),
        status: STATUSES.includes(body.status as (typeof STATUSES)[number]) ? (body.status as (typeof STATUSES)[number]) : "DRAFT",
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("tests:create", err);
  }
}
