// "About the Academy" media item API — ADMIN-managed (update/replace, delete).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { cleanupMediaAssets } from "@/lib/media-cleanup";

export const dynamic = "force-dynamic";

function isMissingAboutTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("P2021") && msg.includes("AboutImage");
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating an About image");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const patch = {
    ...(typeof body.imageUrl === "string" && body.imageUrl.trim() !== "" ? { imageUrl: body.imageUrl.trim() } : {}),
    ...(typeof body.publicId === "string" ? { publicId: body.publicId } : {}),
    ...(typeof body.caption === "string" ? { caption: body.caption } : {}),
    ...(typeof body.altText === "string" ? { altText: body.altText } : {}),
    ...(typeof body.displayOrder === "number" ? { displayOrder: Math.max(0, Math.round(body.displayOrder)) } : {}),
    ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
  };
  if (Object.keys(patch).length === 0) return fail("No changes provided.", 400);
  try {
    const row = await db.aboutImage.update({ where: { id }, data: patch });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("About image not found.", 404);
    if (isMissingAboutTable(err)) {
      return fail("The About media database update has not been applied yet — run it before editing images.", 503);
    }
    return serverError("aboutMedia:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting an About image");
  try {
    const row = await db.aboutImage.findUnique({ where: { id } });
    if (!row) return fail("About image not found.", 404);
    await db.aboutImage.delete({ where: { id } });
    // Database delete succeeded — free the media file best-effort (external
    // URLs without a public id are never touched; referenced assets kept).
    const warning = await cleanupMediaAssets(db, [{ publicId: row.publicId, resourceType: "image" }]);
    return warning ? ok({ deleted: true, warning }) : ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("About image not found.", 404);
    if (isMissingAboutTable(err)) {
      return fail("The About media database update has not been applied yet — run it before deleting images.", 503);
    }
    return serverError("aboutMedia:delete", err);
  }
}
