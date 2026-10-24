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
    if (isMissingMediaColumns(err)) {
      // Migration pending — reply with the legacy columns only.
      try {
        const row = await db.galleryItem.findUnique({
          where: { id },
          select: { id: true, title: true, description: true, imageUrl: true, category: true, displayOrder: true, isActive: true, createdAt: true, updatedAt: true },
        });
        if (!row) return fail("Gallery item not found.", 404);
        return ok({
          item: { ...row, mediaType: "image", videoUrl: null, publicId: null, videoPublicId: null, caption: null, altText: null, animation: "none" },
          warning: "Media fields pending a database update; showing the legacy item.",
        });
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : "";
        if (msg2.includes("P2025")) return fail("Gallery item not found.", 404);
        return serverError("gallery:get", err2);
      }
    }
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
        // Transitional write: count-only updateMany (model-level update also
        // fetches the full row afterwards, which needs the pending columns),
        // then reply with the pre-read legacy shape merged with the patch.
        const legacySelect = { id: true, title: true, description: true, imageUrl: true, category: true, displayOrder: true, isActive: true, createdAt: true, updatedAt: true } as const;
        const before = await db.galleryItem.findUnique({ where: { id }, select: legacySelect });
        if (!before) return fail("Gallery item not found.", 404);
        const legacyPatch: Record<string, unknown> = {};
        for (const key of ["title", "description", "imageUrl", "category", "isActive", "displayOrder"] as const) {
          if (patch[key] !== undefined) legacyPatch[key] = patch[key];
        }
        const result = await db.galleryItem.updateMany({ where: { id }, data: legacyPatch });
        if (result.count !== 1) return fail("Gallery item not found.", 404);
        const item = {
          ...before,
          ...legacyPatch,
          mediaType: "image",
          videoUrl: null,
          publicId: null,
          videoPublicId: null,
          caption: null,
          altText: null,
          animation: "none",
          updatedAt: new Date(),
        };
        return ok({ item, warning: "Updated without the new media fields — the academy-media database update has not been applied yet." });
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
  // Media asset ids live in columns the pending academy-media migration adds;
  // resolve them best-effort so Cloudinary cleanup still runs when present.
  let mediaIds: { publicId: string | null; videoPublicId: string | null } | null = null;
  let pendingMediaUpdate = false;
  try {
    const full = await db.galleryItem.findUnique({
      where: { id },
      select: { id: true, publicId: true, videoPublicId: true },
    });
    if (full) mediaIds = { publicId: full.publicId, videoPublicId: full.videoPublicId };
  } catch (err) {
    if (isMissingMediaColumns(err)) pendingMediaUpdate = true;
    else return serverError("gallery:delete", err);
  }
  try {
    const exists = await db.galleryItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return fail("Gallery item not found.", 404);
    // deleteMany performs a pure delete; the model-level delete additionally
    // fetches the full row, which needs the pending academy-media columns.
    const result = await db.galleryItem.deleteMany({ where: { id } });
    if (result.count !== 1) return fail("Gallery item not found.", 404);
    // Database delete succeeded — free its media files best-effort (external
    // URLs without a public id are never touched; referenced assets kept).
    const cleanupWarning = await cleanupMediaAssets(db, [
      { publicId: mediaIds?.publicId, resourceType: "image" },
      { publicId: mediaIds?.videoPublicId, resourceType: "video" },
    ]);
    const warning =
      pendingMediaUpdate && !cleanupWarning
        ? "Deleted without media-file cleanup — the academy-media database update has not been applied yet."
        : cleanupWarning;
    return warning ? ok({ deleted: true, warning }) : ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Gallery item not found.", 404);
    return serverError("gallery:delete", err);
  }
}
