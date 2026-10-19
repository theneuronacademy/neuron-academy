// Phase 19 — Admin Test Access Grant Update/Delete
// PATCH: Update grant (revoke, extend)
// DELETE: Delete grant (admin cleanup)

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Updating test access grant");

  let body: { status?: "ACTIVE" | "REVOKED" | "EXPIRED"; expiresAt?: string | null };

  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const { status, expiresAt } = body;

  try {
    const existing = await db.testAccess.findUnique({
      where: { id },
      include: {
        test: { select: { id: true, title: true, accessType: true } },
        student: { select: { id: true, name: true, email: true } },
        granter: { select: { id: true, name: true, email: true } },
      },
    });

    if (!existing) return fail("Grant not found", 404);

    const beforeData = {
      status: existing.status,
      expiresAt: existing.expiresAt?.toISOString() || null,
    };

    const updateData: any = {};
    if (status) updateData.status = status;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    const updated = await db.testAccess.update({
      where: { id },
      data: updateData,
      include: {
        test: { select: { title: true } },
        student: { select: { name: true, email: true } },
      },
    });

    const afterData = {
      status: updated.status,
      expiresAt: updated.expiresAt?.toISOString() || null,
    };

    await writeAuditLog(
      auth.user.id,
      auth.user.email,
      status === "REVOKED" ? "PERMISSION_REVOKE" : "BULK_UPDATE",
      "TestAccess",
      id,
      beforeData,
      afterData,
      req,
      `grant-update-${id}`
    );

    return ok({
      item: {
        id: updated.id,
        testId: updated.testId,
        testTitle: updated.test.title,
        studentId: updated.studentId,
        studentName: updated.student.name,
        studentEmail: updated.student.email,
        status: updated.status,
        grantedAt: updated.grantedAt.toISOString(),
        expiresAt: updated.expiresAt?.toISOString() || null,
      },
    });
  } catch (err) {
    return serverError("admin:test-access:grants:update", err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Deleting test access grant");

  try {
    const existing = await db.testAccess.findUnique({
      where: { id },
      include: {
        test: { select: { title: true } },
        student: { select: { name: true, email: true } },
      },
    });

    if (!existing) return fail("Grant not found", 404);

    const beforeData = {
      status: existing.status,
      expiresAt: existing.expiresAt?.toISOString() || null,
    };

    await db.testAccess.delete({ where: { id } });

    await writeAuditLog(
      auth.user.id,
      auth.user.email,
      "DELETE",
      "TestAccess",
      id,
      beforeData,
      null,
      req,
      `grant-delete-${id}`
    );

    return ok({ deleted: true });
  } catch (err) {
    return serverError("admin:test-access:grants:delete", err);
  }
}