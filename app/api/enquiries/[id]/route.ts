// Phase 3 — Enquiry detail API (status changes + deletion).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "CONTACTED", "CONVERTED", "CLOSED"] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading an enquiry");
  try {
    const row = await db.enquiry.findUnique({ where: { id }, include: { course: true } });
    if (!row) return fail("Enquiry not found.", 404);
    return ok({ item: row });
  } catch (err) {
    return serverError("enquiries:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating an enquiry");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) return fail("Invalid status.", 400);
  try {
    const row = await db.enquiry.update({ where: { id }, data: { status: body.status as (typeof STATUSES)[number] } });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Enquiry not found.", 404);
    return serverError("enquiries:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting an enquiry");
  try {
    await db.enquiry.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Enquiry not found.", 404);
    return serverError("enquiries:delete", err);
  }
}
