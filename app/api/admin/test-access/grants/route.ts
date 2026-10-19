// Phase 19 — Admin Test Access Grants API
// GET: List grants with filters
// POST: Create new grant (payment reconciliation)

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Reading test access grants");

  try {
    const params = new URL(req.url).searchParams;
    const testId = params.get("testId") || undefined;
    const status = params.get("status") || undefined;
    const search = params.get("search")?.trim() || "";
    const limit = Math.min(parseInt(params.get("limit") || "100"), 500);

    const where: any = {};
    if (testId) where.testId = testId;
    if (status) where.status = status;

    if (search) {
      const searchTerms = search.toLowerCase().split(" ").filter(Boolean);
      where.OR = [
        { test: { title: { contains: search, mode: "insensitive" } } },
        { student: { name: { contains: search, mode: "insensitive" } } },
        { student: { email: { contains: search, mode: "insensitive" } } },
        { student: { studentId: { contains: search, mode: "insensitive" } } },
        { paymentRef: { contains: search, mode: "insensitive" } },
      ];
    }

    const grants = await db.testAccess.findMany({
      where,
      include: {
        test: { select: { id: true, title: true, accessType: true, price: true, batch: { select: { name: true } } } },
        student: { select: { id: true, studentId: true, name: true, email: true, batch: { select: { name: true } } } },
        granter: { select: { id: true, name: true, email: true } },
      },
      orderBy: { grantedAt: "desc" },
      take: limit,
    });

    const items = grants.map((g) => ({
      id: g.id,
      testId: g.testId,
      testTitle: g.test.title,
      testAccessType: g.test.accessType,
      testPrice: g.test.price,
      testBatch: g.test.batch?.name || "Open",
      studentId: g.studentId,
      studentName: g.student.name,
      studentEmail: g.student.email,
      studentBatch: g.student.batch?.name || "—",
      grantedBy: g.granter?.name || "System",
      status: g.status,
      grantedAt: g.grantedAt.toISOString(),
      expiresAt: g.expiresAt?.toISOString() || null,
    }));

    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("admin:test-access:grants:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Creating test access grant");

  let body: {
    testId: string;
    studentId: string;
    expiresAt?: string | null;
    paymentRef?: string | null;
    amount?: number | null;
  };

  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const { testId, studentId, expiresAt, paymentRef, amount } = body;

  if (!testId || !studentId) {
    return fail("testId and studentId are required", 400);
  }

  try {
    const [test, student] = await Promise.all([
      db.test.findUnique({ where: { id: testId }, select: { id: true, title: true, accessType: true, price: true, batchId: true } }),
      db.student.findUnique({ where: { id: studentId }, select: { id: true, name: true, email: true, batchId: true, studentType: true, status: true } }),
    ]);

    if (!test) return fail("Test not found", 404);
    if (!student) return fail("Student not found", 404);
    if (student.status !== "ACTIVE") return fail("Student is not active", 400);
    if (test.accessType === "FREE") return fail("FREE tests do not require grants", 400);

    if (test.batchId && student.batchId && test.batchId !== student.batchId) {
      const isScholarship = student.studentType === "SCHOLARSHIP";
      if (!isScholarship) return fail("Student is not in the test's batch", 400);
    }

    const existingActive = await db.testAccess.findFirst({
      where: { testId, studentId, status: "ACTIVE" },
    });

    if (existingActive) {
      if (existingActive.expiresAt && existingActive.expiresAt > new Date()) {
        return fail("Student already has active access to this test", 409);
      }
      await db.testAccess.update({
        where: { id: existingActive.id },
        data: { status: "REVOKED" },
      });
    }

    const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
    const grant = await db.testAccess.create({
      data: {
        testId,
        studentId,
        grantedBy: auth.user.id,
        status: "ACTIVE",
        expiresAt: expiresAtDate,
      },
      include: {
        test: { select: { title: true, accessType: true, price: true } },
        student: { select: { name: true, email: true } },
        granter: { select: { name: true, email: true } },
      },
    });

    await writeAuditLog(
      auth.user.id,
      auth.user.email,
      "PERMISSION_GRANT",
      "TestAccess",
      grant.id,
      null,
      {
        testId,
        studentId,
        expiresAt: expiresAtDate?.toISOString(),
        paymentRef,
        amount,
      },
      req,
      `grant-${grant.id}`
    );

    return ok({
      item: {
        id: grant.id,
        testId: grant.testId,
        testTitle: grant.test.title,
        studentId: grant.studentId,
        studentName: grant.student.name,
        studentEmail: grant.student.email,
        grantedBy: grant.granter?.name || "System",
        status: grant.status,
        grantedAt: grant.grantedAt.toISOString(),
        expiresAt: grant.expiresAt?.toISOString() || null,
      },
    }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes("P2002")) {
      return fail("Grant already exists for this test and student", 409);
    }
    return serverError("admin:test-access:grants:create", err);
  }
}