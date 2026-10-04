// Phase 3 — Gallery item detail API.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a gallery photo");
  try {
    const row = await db.galleryItem.findUnique({ where: { id } });
    if (!row) return fail("Gallery photo not found.", 404);
    return ok({ item: row });
  } catch (err) {
    return serverError("gallery:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a gallery photo");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const row = await db.galleryItem.update({
      where: { id },
      data: {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(typeof body.imageUrl === "string" ? { imageUrl: body.imageUrl } : {}),
        ...(typeof body.category === "string" ? { category: body.category } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        ...(typeof body.displayOrder === "number" ? { displayOrder: body.displayOrder } : {}),
      },
    });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Gallery photo not found.", 404);
    return serverError("gallery:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a gallery photo");
  try {
    await db.galleryItem.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Gallery photo not found.", 404);
    return serverError("gallery:delete", err);
  }
}
