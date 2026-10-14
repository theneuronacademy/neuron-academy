// Phase 3 — Students API. Demo fallback when DATABASE_URL is missing.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { isEmail, isNonEmpty, isPhone, missingFields, parseDate } from "@/lib/validation";
import { DEMO_STUDENTS } from "@/data/admin";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAdmin(s: any) {
  return {
    id: s.id,
    studentId: s.studentId,
    name: s.name,
    email: s.email,
    phone: s.phone,
    batch: s.batch?.name ?? "—",
    course: s.course?.name ?? "—",
    joiningDate: s.joiningDate ? new Date(s.joiningDate).toISOString().slice(0, 10) : "",
    attendancePct: 0,
    avgScore: 0,
    status: String(s.status ?? "ACTIVE").toLowerCase() === "inactive" ? "inactive" : "active",
  };
}

export async function GET(req: NextRequest) {
  // Student directory contains PII — ADMIN only (website never lists students).
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return ok({ items: DEMO_STUDENTS, source: "demo" });
  try {
    // Phase 13 — optional ?search= filters name / mobile / email (test-access console).
    // Phase 14 — ?type=REGULAR|SCHOLARSHIP and ?status=ACTIVE|INACTIVE filters.
    const params = new URL(req.url).searchParams;
    const search = params.get("search")?.trim() ?? "";
    const type = params.get("type") ?? "";
    const status = params.get("status") ?? "";
    const digits = search.replace(/\D/g, "");
    const rows = await db.student.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                ...(digits ? [{ phone: { contains: digits } }] : []),
              ],
            }
          : {}),
        ...(type === "REGULAR" || type === "SCHOLARSHIP" ? { studentType: type as "REGULAR" | "SCHOLARSHIP" } : {}),
        ...(status === "ACTIVE" || status === "INACTIVE" ? { status: status as "ACTIVE" | "INACTIVE" } : {}),
      },
      include: { batch: true, course: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok({ items: rows.map(toAdmin), source: "database" });
  } catch (err) {
    return serverError("students:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating a student");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["name", "phone"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  if (body.email !== undefined && body.email !== "" && !isEmail(body.email)) return fail("Invalid email.", 400);
  if (!isPhone(body.phone)) return fail("Invalid phone.", 400);
  try {
    const created = await db.student.create({
      data: {
        studentId: isNonEmpty(body.studentId) ? String(body.studentId) : `NA-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
        name: String(body.name),
        email: isNonEmpty(body.email) ? String(body.email) : `${Date.now()}@student.local`,
        phone: String(body.phone),
        batchId: isNonEmpty(body.batchId) ? String(body.batchId) : undefined,
        courseId: isNonEmpty(body.courseId) ? String(body.courseId) : undefined,
        joiningDate: parseDate(body.joiningDate) ?? new Date(),
      },
      include: { batch: true, course: true },
    });
    return ok({ item: toAdmin(created) }, 201);
  } catch (err) {
    return serverError("students:create", err);
  }
}
