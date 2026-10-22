// Phase 20 — Cloudinary direct upload URL API (ADMIN only).
// Generates a Cloudinary signed direct-upload payload that clients (browsers)
// can use to upload large videos straight to Cloudinary, bypassing serverless
// function request body size limits and timeouts.
// - The API secret never reaches the client.
// - Signature covers ONLY folder, public_id, timestamp (sorted, SHA-1 hex, secret appended).
// - api_key goes in the form body but is never signed.
// - Used for: large video uploads where routing through the /upload proxy would
//   risk Vercel request body limits.

import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { requireApiRole } from "@/lib/server-auth";
import {
  generateUploadSignature,
  validateCloudinaryFileFromMetadata,
  getCloudinaryFolder,
  validateCloudinaryFolder,
  CLOUDINARY_MAX_VIDEO_BYTES,
} from "@/lib/cloudinary";

const VALID_CATEGORIES = [
  "branding",
  "about",
  "classroom",
  "banners",
  "advertisements",
  "gallery",
  "courses",
  "faculty",
  "study-material",
] as const;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  if (!cloudName || !apiKey || !process.env.CLOUDINARY_API_SECRET) {
    return fail("Media storage is not configured. Set the Cloudinary environment variables.", 503);
  }

  let filename: string | null = null;
  let category: string | null = null;
  let fileSize = 0;

  try {
    const form = await req.formData();
    const fn = form.get("filename");
    const cat = form.get("category");
    const fs = form.get("fileSize");

    if (typeof fn !== "string") return fail("Invalid filename.", 400);
    if (typeof cat !== "string") return fail("Invalid category.", 400);
    if (typeof fs !== "string" || fs.length === 0) return fail("File size is required.", 400);
    const n = Number(fs);
    if (!Number.isFinite(n) || n <= 0) return fail("Invalid file size.", 400);

    filename = fn;
    category = cat;
    fileSize = n;
  } catch {
    return fail("Invalid form data.", 400);
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return fail(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}.`, 400);
  }

  // Enforce video size limit (100 MB)
  if (fileSize > CLOUDINARY_MAX_VIDEO_BYTES) {
    return fail(
      `Video exceeds maximum size of ${Math.round(CLOUDINARY_MAX_VIDEO_BYTES / 1024 / 1024)} MB.`,
      400
    );
  }

  // Validate extension via metadata
  const metadataError = validateCloudinaryFileFromMetadata(filename, "video", fileSize);
  if (metadataError) return fail(metadataError, 400);

  // Resolve folder
  const folder = getCloudinaryFolder(category);
  if (!folder) return fail(`Unknown category: ${category}`, 400);
  const folderError = validateCloudinaryFolder(folder);
  if (folderError) return fail(folderError, 400);

  // Deterministic public_id inside the category folder
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const base = filename.slice(0, filename.length - ext.length - 1);
  const safeBase = base.replace(/[^a-zA-Z0-9\-_]/g, "-").slice(0, 48) || "media";
  const publicId = `${safeBase}-${Date.now()}`;

  // Correct Cloudinary signature: SHA-1 HEX digest of sorted params + secret.
  // Only folder, public_id, timestamp are signed.
  const { timestamp, signature } = generateUploadSignature(folder, publicId);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

  return ok({
    uploadUrl,
    formFields: {
      api_key: apiKey,
      timestamp,
      signature,
      folder,
      public_id: publicId,
    },
    category,
    resourceType: "video",
    maxVideoBytes: CLOUDINARY_MAX_VIDEO_BYTES,
    fileSize,
  });
}