// Gallery item detail API — academy media (images AND videos), ADMIN-managed.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { toBannerAnimation } from "@/components/website/bannerMotion";
import { cleanupMediaAssets } from "@/lib/media-cleanup";

export const dynamic = "force-dynamic";

// Columns introduced by the additive academy-media migration; PATCH retries
// without them (with an honest warning) while the database update is pending.
const MEDIA_FIELDS = ["mediaType", "videoUrl", "publicId", "videoPublicId", "caption", "altText", "animation"] as const;

function isMissingMediaColumns(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("P2022") && MEDIA_FIELDS.some((f) => msg.includes(f));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a gallery item");
  try {
    const row = await db.galleryItem.findUnique({ where: { id } });
    if (!row) return fail("Gallery item not found.", 404);
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
  if (!db) return dbNotConfigured("Updating a gallery item");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  if (body.mediaType !== undefined && body.mediaType !== "image" && body.mediaType !== "video") {
    return fail("mediaType must be \"image\" or \"video\".", 400);
  }
  const patch: Record<string, unknown> = {
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(typeof body.description === "string" ? { description: body.description } : {}),
    ...(typeof body.imageUrl === "string" ? { imageUrl: body.imageUrl } : {}),
    ...(typeof body.videoUrl === "string" ? { videoUrl: body.videoUrl } : {}),
    ...(typeof body.publicId === "string" ? { publicId: body.publicId } : {}),
    ...(typeof body.videoPublicId === "string" ? { videoPublicId: body.videoPublicId } : {}),
    ...(typeof body.caption === "string" ? { caption: body.caption } : {}),
    ...(typeof body.altText === "string" ? { altText: body.altText } : {}),
    ...(body.mediaType === "image" || body.mediaType === "video" ? { mediaType: body.mediaType } : {}),
    ...(typeof body.category === "string" ? { category: body.category } : {}),
    ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
    ...(typeof body.displayOrder === "number" ? { displayOrder: Math.max(0, Math.round(body.displayOrder)) } : {}),
    ...(body.animation !== undefined ? { animation: toBannerAnimation(body.animation) } : {}),
  };
  if (Object.keys(patch).length === 0) return fail("No changes provided.", 400);
  try {
    const row = await db.galleryItem.update({ where: { id }, data: patch });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Gallery item not found.", 404);
    if (isMissingMediaColumns(err)) {
      try {
        // Explicit legacy shape (only the pre-media columns).
        const legacy = {
          title: patch.title as string | undefined,
          description: patch.description as string | undefined,
          imageUrl: patch.imageUrl as string | undefined,
          category: patch.category as string | undefined,
          isActive: patch.isActive as boolean | undefined,
          displayOrder: patch.displayOrder as number | undefined,
        };
        const row = await db.galleryItem.update({ where: { id }, data: legacy });
        return ok({ item: row, warning: "Updated without the new media fields — the academy-media database update has not been applied yet." });
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : "";
        if (msg2.includes("P2025")) return fail("Gallery item not found.", 404);
        return serverError("gallery:update", err2);
      }
    }
    return serverError("gallery:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a gallery item");
  try {
    const row = await db.galleryItem.findUnique({ where: { id } });
    if (!row) return fail("Gallery item not found.", 404);
    await db.galleryItem.delete({ where: { id } });
    // Database delete succeeded — free its media files best-effort (external
    // URLs without a public id are never touched; referenced assets kept).
    const warning = await cleanupMediaAssets(db, [
      { publicId: row.publicId, resourceType: "image" },
      { publicId: row.videoPublicId, resourceType: "video" },
    ]);
    return warning ? ok({ deleted: true, warning }) : ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Gallery item not found.", 404);
    return serverError("gallery:delete", err);
  }
}
