// Phase 3 — Batches API. Demo fallback when DATABASE_URL is missing.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { getUserFromRequest } from "@/lib/session";
import { isNonEmpty, missingFields, parseDate } from "@/lib/validation";
import { DEMO_BATCHES } from "@/data/admin";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAdmin(b: any) {
  return {
    id: b.id,
    name: b.name,
    course: b.course?.name ?? "—",
    faculty: b.faculty?.name ?? "Unassigned",
    studentCount: typeof b._count?.students === "number" ? b._count.students : (b.studentCount ?? 0),
    startDate: b.startDate ? new Date(b.startDate).toISOString().slice(0, 10) : "",
    endDate: b.endDate ? new Date(b.endDate).toISOString().slice(0, 10) : "",
    status: String(b.status ?? "ACTIVE").toLowerCase(),
  };
}

export async function GET(req: NextRequest) {
  const facultyId = new URL(req.url).searchParams.get("facultyId");
  const db = getDb();
  if (!db) {
    if (facultyId) return ok({ items: [], source: "demo" });
    return ok({ items: DEMO_BATCHES, source: "demo" });
  }
  try {
    if (facultyId) {
      // Phase 17 — the ?facultyId= filter is session-scoped, never
      // client-controlled: ADMIN may query any faculty; a faculty member
      // may query only themselves; everyone else gets no filtered view
      // (prevents anonymous enumeration of a faculty member's batches).
      const viewer = getUserFromRequest(req);
      let effectiveId = facultyId;
      if (!viewer || viewer.role === "STUDENT") {
        return ok({ items: [], source: "database" });
      }
      if (viewer.role === "FACULTY") {
        const mine = await db.faculty.findUnique({ where: { userId: viewer.id }, select: { id: true } });
        if (!mine || (facultyId !== viewer.id && facultyId !== mine.id)) {
          return ok({ items: [], source: "database" });
        }
        effectiveId = mine.id;
      }
      const profile = await db.faculty.findFirst({
        where: { OR: [{ userId: effectiveId }, { id: effectiveId }] },
        select: { id: true },
      });
      if (!profile) return ok({ items: [], source: "database" });
      const rows = await db.batch.findMany({
        where: { facultyId: profile.id },
        include: { course: true, faculty: true, _count: { select: { students: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return ok({ items: rows.map(toAdmin), source: "database" });
    }
    const rows = await db.batch.findMany({
      include: { course: true, faculty: true, _count: { select: { students: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok({ items: rows.map(toAdmin), source: "database" });
  } catch (err) {
    return serverError("batches:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating a batch");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["name", "courseId"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  try {
    const created = await db.batch.create({
      data: {
        name: String(body.name),
        courseId: String(body.courseId),
        facultyId: isNonEmpty(body.facultyId) ? String(body.facultyId) : undefined,
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
      },
      include: { course: true, faculty: true, _count: { select: { students: true } } },
    });
    return ok({ item: toAdmin(created) }, 201);
  } catch (err) {
    return serverError("batches:create", err);
  }
}
