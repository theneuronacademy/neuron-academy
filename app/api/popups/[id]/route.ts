// Phase 3 — Popup detail API.
// TODO auth: writes need ADMIN role once the session layer lands.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { parseDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a popup");
  try {
    const row = await db.popup.findUnique({ where: { id } });
    if (!row) return fail("Popup not found.", 404);
    return ok({ item: row });
  } catch (err) {
    return serverError("popups:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a popup");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const row = await db.popup.update({
      where: { id },
      data: {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.message === "string" ? { message: body.message } : {}),
        ...(typeof body.imageUrl === "string" ? { imageUrl: body.imageUrl } : {}),
        ...(typeof body.videoUrl === "string" ? { videoUrl: body.videoUrl } : {}),
        ...(typeof body.buttonText === "string" ? { buttonText: body.buttonText } : {}),
        ...(typeof body.buttonUrl === "string" ? { buttonUrl: body.buttonUrl } : {}),
        ...(body.frequency === "ONCE_PER_SESSION" || body.frequency === "ONCE_PER_DAY" || body.frequency === "EVERY_VISIT"
          ? { frequency: body.frequency }
          : {}),
        ...(body.startDate !== undefined ? { startDate: parseDate(body.startDate) ?? null } : {}),
        ...(body.endDate !== undefined ? { endDate: parseDate(body.endDate) ?? null } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      },
    });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Popup not found.", 404);
    return serverError("popups:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a popup");
  try {
    await db.popup.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Popup not found.", 404);
    return serverError("popups:delete", err);
  }
}
