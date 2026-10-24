// Server-side media-cleanup helper for content delete flows.
// After a row is deleted from the database, its Cloudinary-managed assets can
// be freed. Rules (trace task for admin media ops):
//  - External / static URLs have no public_id → skipped, never "deleted".
//  - An asset still referenced by any other content row is preserved.
//  - "not found" from Cloudinary (already deleted) is a success.
//  - Cleanup failures NEVER roll back the database deletion; they are logged
//    server-side and surfaced to the admin as a warning on the response.

import type { PrismaClient } from "@prisma/client";
import { removeCloudinaryAsset } from "@/lib/cloudinary";

export interface MediaAssetRef {
  publicId: string | null | undefined;
  resourceType: "image" | "video";
}

export async function cleanupMediaAssets(
  db: PrismaClient,
  assets: MediaAssetRef[]
): Promise<string | null> {
  const seen = new Set<string>();
  let failed = false;
  for (const asset of assets) {
    const publicId = (asset.publicId ?? "").trim();
    if (!publicId || seen.has(publicId)) continue;
    seen.add(publicId);
    try {
      // Reference preservation check across the media content tables.
      const [galleryRefs, aboutRefs] = await Promise.all([
        db.galleryItem.count({ where: { OR: [{ publicId }, { videoPublicId: publicId }] } }),
        db.aboutImage.count({ where: { publicId } }),
      ]);
      if (galleryRefs > 0 || aboutRefs > 0) continue; // still referenced elsewhere
      const result = await removeCloudinaryAsset(publicId, { resourceType: asset.resourceType });
      if (!result.ok) {
        failed = true;
        console.warn(`[media-cleanup] Could not remove ${publicId}: ${result.error}`);
      }
      // result.ok && deleted === false → already gone; harmless, counts as success.
    } catch (err) {
      failed = true;
      console.warn(`[media-cleanup] Cleanup failed for ${publicId}:`, err);
    }
  }
  return failed ? "Content deleted, but some of its media files could not be removed from storage." : null;
}
