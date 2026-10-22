// Phase 20 — Cloudinary signed upload signature API (ADMIN only).
// An authenticated admin requests an upload signature, and the server returns
// a Cloudinary signed URL + form fields. The client uses these to upload
// directly to Cloudinary, bypassing serverless request size limits.
// - The API secret NEVER leaves the server.
// - The signed URL includes: folder, resource_type, timestamp, signature.
// - The URL is time‑limited (timestamp + signature validation).
// - Used by: admin UI upload flows for images and videos.

import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { requireApiRole } from "@/lib/server-auth";
import {
  generateUploadSignature,
  validateCloudinaryFileFromMetadata,
  getCloudinaryFolder,
  validateCloudinaryFolder,
  CLOUDINARY_MAX_IMAGE_BYTES,
  CLOUDINARY_MAX_VIDEO_BYTES,
} from "@/lib/cloudinary";

// Allowed categories map to neuron-academy/ folders (requirement 9)
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
  let resourceType: "image" | "video" = "image";
  let fileSize: number | undefined = undefined;

  try {
    const form = await req.formData();
    const fn = form.get("filename");
    const cat = form.get("category");
    const rt = form.get("resourceType");
    const fs = form.get("fileSize");

    if (typeof fn !== "string") return fail("Invalid filename.", 400);
    if (typeof cat !== "string") return fail("Invalid category.", 400);
    if (rt === "video") resourceType = "video";
    if (typeof fs === "string" && fs.length > 0) {
      const n = Number(fs);
      if (!Number.isFinite(n) || n <= 0) return fail("Invalid file size.", 400);
      fileSize = n;
    }

    filename = fn;
    category = cat;
  } catch {
    return fail("Invalid form data.", 400);
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return fail(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}.`, 400);
  }

  // Validate extension / size using metadata only (bytes go straight to Cloudinary)
  const metadataError = validateCloudinaryFileFromMetadata(filename, resourceType, fileSize);
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

  // Correct Cloudinary signature: SHA-1 HEX of sorted "key=value&..." + secret.
  // Signed params are ONLY folder, public_id, timestamp.
  // api_key / cloud_name / resource_type / file go in the body, never in the signature.
  const { timestamp, signature } = generateUploadSignature(folder, publicId);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

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
    resourceType,
    maxImageBytes: CLOUDINARY_MAX_IMAGE_BYTES,
    maxVideoBytes: CLOUDINARY_MAX_VIDEO_BYTES,
  });
}