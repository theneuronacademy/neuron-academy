// Phase 13 — TestAccess detail: ADMIN-only revoke / update / delete.
// Students can never modify access records (only read their own via GET
// /api/test-access). Faculty cannot touch access records.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { notifyMessages } from "@/lib/notify";
import { dispatchNotification } from "@/services/notificationEngine";
import { parseDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

const STATUSES = ["ACTIVE", "REVOKED", "EXPIRED"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating test access");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const row = await db.testAccess.findUnique({
      where: { id },
      include: { test: { select: { id: true, title: true } } },
    });
    if (!row) return fail("Access record not found.", 404);
    const nextStatus =
      typeof body.status === "string" && (STATUSES as readonly string[]).includes(body.status)
        ? (body.status as (typeof STATUSES)[number])
        : undefined;
    const expiresAt = body.expiresAt === null ? null : body.expiresAt !== undefined ? (parseDate(body.expiresAt) ?? null) : undefined;
    if (body.expiresAt !== undefined && body.expiresAt !== null && expiresAt === null && body.expiresAt !== "") {
      return fail("Invalid expiry date.", 400);
    }
    if (expiresAt instanceof Date && expiresAt.getTime() <= Date.now() && nextStatus !== "EXPIRED") {
      return fail("Expiry must be in the future.", 400);
    }
    if (nextStatus === "ACTIVE") {
      const clash = await db.testAccess.findFirst({
        where: { testId: row.testId, studentId: row.studentId, status: "ACTIVE", NOT: { id: row.id } },
        select: { id: true },
      });
      if (clash) return fail("This student already has another active grant for this test.", 409);
    }
    const updated = await db.testAccess.update({
      where: { id },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
      },
    });
    // Phase 18b — revoke notifies once per transition (already-revoked rows
    // stay silent), via the centralized engine (ACCESS_REVOKED, idempotent
    // on test+student): SMS/push/in-app per policy, channels isolated.
    if (nextStatus === "REVOKED" && row.status !== "REVOKED") {
      const msg = notifyMessages.accessRevoked(row.test.title);
      await dispatchNotification(db, {
        event: "ACCESS_REVOKED",
        actor: { id: auth.user.id, role: auth.user.role },
        audience: { kind: "INDIVIDUAL", studentId: row.studentId },
        title: msg.title,
        message: msg.message,
        templateKey: "ACCESS_REVOKED",
        vars: { testName: row.test.title },
        testId: row.testId,
        createdById: auth.user.id,
        internal: true,
        idempotencyKey: `ACCESS_REVOKED:${row.testId}:${row.studentId}`,
      });
    }
    return ok({ item: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Access record not found.", 404);
    return serverError("test-access:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting test access");
  try {
    await db.testAccess.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Access record not found.", 404);
    return serverError("test-access:delete", err);
  }
}
