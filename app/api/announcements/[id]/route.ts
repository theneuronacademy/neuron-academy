// Phase 3 — Announcement detail API.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { parseDate } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // P0: announcement detail is public website content (list GET is public
  // and every sibling CMS detail GET — banners, gallery, popups,
  // testimonials, courses, batches — is public). Writes stay ADMIN-only.
  const db = getDb();
  if (!db) return dbNotConfigured("Reading an announcement");
  try {
    const row = await db.announcement.findUnique({ where: { id } });
    if (!row) return fail("Announcement not found.", 404);
    return ok({ item: row });
  } catch (err) {
    return serverError("announcements:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating an announcement");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const row = await db.announcement.update({
      where: { id },
      data: {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.content === "string" ? { content: body.content } : {}),
        ...(typeof body.imageUrl === "string" ? { imageUrl: body.imageUrl } : {}),
        ...(body.startDate !== undefined ? { startDate: parseDate(body.startDate) ?? null } : {}),
        ...(body.endDate !== undefined ? { endDate: parseDate(body.endDate) ?? null } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      },
    });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Announcement not found.", 404);
    return serverError("announcements:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting an announcement");
  try {
    await db.announcement.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Announcement not found.", 404);
    return serverError("announcements:delete", err);
  }
}
