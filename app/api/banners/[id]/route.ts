// Phase 3 — Banner detail API.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { parseDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

function patch(body: Record<string, unknown>) {
  return {
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(typeof body.subtitle === "string" ? { subtitle: body.subtitle } : {}),
    ...(typeof body.description === "string" ? { description: body.description } : {}),
    ...(typeof body.imageUrl === "string" ? { imageUrl: body.imageUrl } : {}),
    ...(typeof body.videoUrl === "string" ? { videoUrl: body.videoUrl } : {}),
    ...(typeof body.buttonText === "string" ? { buttonText: body.buttonText } : {}),
    ...(typeof body.buttonUrl === "string" ? { buttonUrl: body.buttonUrl } : {}),
    ...(body.startDate !== undefined ? { startDate: parseDate(body.startDate) ?? null } : {}),
    ...(body.endDate !== undefined ? { endDate: parseDate(body.endDate) ?? null } : {}),
    ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
    ...(typeof body.displayOrder === "number" ? { displayOrder: body.displayOrder } : {}),
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a banner");
  try {
    const row = await db.banner.findUnique({ where: { id } });
    if (!row) return fail("Banner not found.", 404);
    return ok({ item: row });
  } catch (err) {
    return serverError("banners:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a banner");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const row = await db.banner.update({ where: { id }, data: patch(body) });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Banner not found.", 404);
    return serverError("banners:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a banner");
  try {
    await db.banner.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Banner not found.", 404);
    return serverError("banners:delete", err);
  }
}
