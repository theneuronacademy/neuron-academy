// Phase 13 — TestAccess management.
// GET:  ADMIN → grants (filters: testId, studentId, status).
//       STUDENT → own grants only (studentId derived from session, never client).
//       FACULTY → forbidden (cannot grant or browse access records).
// POST: ADMIN grants access after externally confirming payment.
//       "Payment is handled externally. Admin grants access after payment
//       confirmation." No gateway, no online payment — manual grant only.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { resolveStudent } from "@/lib/testAccess";
import { safeNotify, notifyMessages } from "@/lib/notify";
import { parseDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

const STATUSES = ["ACTIVE", "REVOKED", "EXPIRED"] as const;

function shape(row: {
  id: string;
  status: string;
  grantedAt: Date;
  expiresAt: Date | null;
  test: { id: string; title: string; accessType: string; price: number; status: string };
  student: { id: string; name: string; phone: string; email: string };
}) {
  return {
    id: row.id,
    status: row.status,
    grantedAt: row.grantedAt,
    expiresAt: row.expiresAt,
    test: row.test,
    student: row.student,
  };
}

export async function GET(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading test access");
  try {
    if (viewer.role === "STUDENT") {
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      if (!profile) return ok({ items: [], source: "database" });
      const rows = await db.testAccess.findMany({
        where: { studentId: profile.id },
        include: {
          test: { select: { id: true, title: true, accessType: true, price: true, status: true } },
          student: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return ok({ items: rows.map(shape), source: "database" });
    }
    if (viewer.role !== "ADMIN") return fail("Forbidden.", 403);
    const params = new URL(req.url).searchParams;
    const testId = params.get("testId");
    const studentId = params.get("studentId");
    const status = params.get("status");
    const rows = await db.testAccess.findMany({
      where: {
        ...(testId ? { testId } : {}),
        ...(studentId ? { studentId } : {}),
        ...(status && (STATUSES as readonly string[]).includes(status) ? { status: status as (typeof STATUSES)[number] } : {}),
      },
      include: {
        test: { select: { id: true, title: true, accessType: true, price: true, status: true } },
        student: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok({ items: rows.map(shape), source: "database" });
  } catch (err) {
    return serverError("test-access:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Granting test access");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const testId = typeof body.testId === "string" ? body.testId : "";
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  if (!testId || !studentId) return fail("testId and studentId are required.", 400);
  const expiresAt = parseDate(body.expiresAt) ?? null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) return fail("Expiry must be in the future.", 400);
  try {
    const test = await db.test.findUnique({ where: { id: testId }, select: { id: true, title: true, accessType: true } });
    if (!test) return fail("Test not found.", 404);
    const student = await db.student.findUnique({ where: { id: studentId }, select: { id: true, status: true } });
    if (!student) return fail("Student not found.", 404);
    if (student.status !== "ACTIVE") return fail("Student profile is not active.", 400);
    const existingActive = await db.testAccess.findFirst({ where: { testId, studentId, status: "ACTIVE" }, select: { id: true, expiresAt: true } });
    if (existingActive && (!existingActive.expiresAt || existingActive.expiresAt.getTime() > Date.now())) {
      return fail("This student already has active access to this test.", 409);
    }
    // Keep the (testId, studentId, status) unique invariant clean: drop
    // stale non-active rows before creating the new ACTIVE grant.
    await db.testAccess.deleteMany({ where: { testId, studentId, status: { in: ["REVOKED", "EXPIRED"] } } }).catch(() => null);
    if (existingActive) {
      await db.testAccess.delete({ where: { id: existingActive.id } }).catch(() => null);
    }
    const created = await db.testAccess.create({
      data: { testId, studentId, grantedBy: auth.user.id, status: "ACTIVE", expiresAt },
      include: {
        test: { select: { id: true, title: true, accessType: true, price: true, status: true } },
        student: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
    const msg = notifyMessages.accessGranted(test.title);
    await safeNotify(db, { ...msg, audience: "INDIVIDUAL", targetStudentId: studentId, testId, createdById: auth.user.id });
    return ok({ item: shape(created) }, 201);
  } catch (err) {
    return serverError("test-access:grant", err);
  }
}
