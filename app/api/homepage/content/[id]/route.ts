// PATCH /api/homepage/content/[id] — update a content item
// DELETE /api/homepage/content/[id] — deactivate a content item

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating homepage content");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const update: Record<string, unknown> = {};
  if (typeof body.value === "string") update.value = body.value.trim();
  if (typeof body.type === "string") update.type = body.type.trim();
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;
  if (Object.keys(update).length === 0) return fail("No valid update fields provided.", 400);
  try {
    const item = await db.homepageContent.update({ where: { id }, data: update });
    return ok({ item });
  } catch {
    return fail("Content item not found.", 404);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting homepage content");
  try {
    await db.homepageContent.update({ where: { id }, data: { isActive: false } });
    return ok({ deactivated: true });
  } catch {
    return fail("Content item not found.", 404);
  }
}
