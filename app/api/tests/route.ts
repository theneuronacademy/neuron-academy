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
import { facultyBatchIds, normalizeAccessFields, resolveStudent, STUDENT_VISIBLE_STATUSES, validateAccessFields } from "@/lib/testAccess";
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
    // Public/anonymous: website-visible FREE/PAID tests only (published + live).
    // PRIVATE tests are never listed publicly; deactivated tests are hidden.
    if (!viewer) {
      const rows = await db.test.findMany({
        where: { isActive: true, status: { in: ["PUBLISHED", "LIVE"] }, accessType: { in: ["FREE", "PAID"] } },
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
    // Phase 13 — PRIVATE tests without a grant are hidden; PAID tests
    // without a grant are listed as locked metadata (no questions).
    const profile = await resolveStudent(db, viewer.id, viewer.email);
    if (!profile || profile.status !== "ACTIVE") return ok({ items: [], source: "database" });
    // Phase 14 — SCHOLARSHIP students list every FREE test regardless of
    // batch (plus open/own-batch tests for grants). Regular rule unchanged.
    const isScholarship = profile.studentType === "SCHOLARSHIP";
    const batchScope = profile.batchId ? { OR: [{ batchId: profile.batchId }, { batchId: null }] } : { batchId: null };
    const rows = await db.test.findMany({
      where: {
        isActive: true,
        status: { in: [...STUDENT_VISIBLE_STATUSES] },
        ...(isScholarship ? { OR: [{ accessType: "FREE" }, { batchId: null }, ...(profile.batchId ? [{ batchId: profile.batchId }] : [])] } : batchScope),
      },
      include: { batch: true, _count: { select: { questions: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const grants = await db.testAccess.findMany({
      where: {
        studentId: profile.id,
        testId: { in: rows.map((t) => t.id) },
        status: "ACTIVE",
      },
      select: { testId: true, expiresAt: true },
    });
    const now = Date.now();
    const liveIds = new Set(
      grants.filter((g) => !g.expiresAt || g.expiresAt.getTime() > now).map((g) => g.testId)
    );
    const items = rows
      .filter((t) => t.accessType !== "PRIVATE" || liveIds.has(t.id))
      .map((t) => {
        const open = t.status === "PUBLISHED" || t.status === "LIVE";
        const hasAccess = t.accessType === "FREE" ? open : liveIds.has(t.id);
        const lockReason = hasAccess
          ? null
          : t.accessType === "FREE"
            ? t.status === "SCHEDULED"
              ? "This test has not started yet."
              : t.status === "COMPLETED"
                ? "This test has ended."
                : "This test is not open."
            : t.accessType === "PRIVATE"
              ? "This is a private test."
              : `This is a paid test (₹${t.price}). Contact the academy after payment to unlock access.`;
        return {
          ...t,
          access: {
            accessType: t.accessType,
            price: t.price,
            hasAccess,
            locked: !hasAccess,
            lockReason,
          },
        };
      });
    return ok({ items, source: "database" });
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
  // Homework is a faculty workflow: PRACTICE + FREE + assigned batch, always.
  const wantHomework = body.isHomework === true;
  if (wantHomework) {
    if (auth.user.role === "FACULTY") {
      if (!isNonEmpty(body.batchId)) return fail("Homework needs an assigned batch.", 400);
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (!allowed.includes(String(body.batchId))) return fail("You can assign homework only to your assigned batches.", 403);
    } else if (body.batchId !== undefined && body.batchId !== null && body.batchId !== "") {
      const b = await db.batch.findUnique({ where: { id: String(body.batchId) }, select: { id: true } });
      if (!b) return fail("Batch not found.", 404);
    }
  }
  // Phase 13 — only ADMIN may set access type / price. Faculty tests are FREE.
  if (auth.user.role === "FACULTY" && (body.accessType !== undefined || body.price !== undefined)) {
    return fail("Only admins can set test access type or price.", 403);
  }
  const accessErr = auth.user.role === "ADMIN" ? validateAccessFields(body.accessType, body.price) : null;
  if (accessErr) return fail(accessErr, 400);
  const access = normalizeAccessFields(body.accessType, body.price);
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
        questionOrder: body.questionOrder === "RANDOM" ? "RANDOM" : "SERIAL",
        optionOrder: body.optionOrder === "RANDOM" ? "RANDOM" : "SERIAL",
        // Homework stays PRACTICE + FREE regardless of role input.
        ...(wantHomework ? { type: "PRACTICE" as const, isHomework: true } : {}),
        ...(auth.user.role === "ADMIN" ? { accessType: access.accessType, price: access.price } : {}),
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("tests:create", err);
  }
}
