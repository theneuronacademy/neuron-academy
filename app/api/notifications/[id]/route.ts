// Phase 3 — Notification detail API.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a notification");
  try {
    const row = await db.notification.findUnique({ where: { id } });
    if (!row) return fail("Notification not found.", 404);
    return ok({ item: row });
  } catch (err) {
    return serverError("notifications:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a notification");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const row = await db.notification.update({
      where: { id },
      data: {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.message === "string" ? { message: body.message } : {}),
        ...(body.status === "DRAFT" || body.status === "SCHEDULED" || body.status === "SENT" ? { status: body.status } : {}),
        ...(body.status === "SENT" ? { sentAt: new Date() } : {}),
      },
    });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Notification not found.", 404);
    return serverError("notifications:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a notification");
  try {
    await db.notification.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Notification not found.", 404);
    return serverError("notifications:delete", err);
  }
}
