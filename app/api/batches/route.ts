// Phase 3 — Batches API. Demo fallback when DATABASE_URL is missing.
// TODO auth: writes need ADMIN role once the session layer lands.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
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

export async function GET() {
  const db = getDb();
  if (!db) return ok({ items: DEMO_BATCHES, source: "demo" });
  try {
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
