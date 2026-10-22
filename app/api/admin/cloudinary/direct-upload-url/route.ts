// Phase 20 — Cloudinary direct upload URL API (ADMIN only).
// Generates a time‑limited Cloudinary direct upload URL that clients (browsers)
// can use to upload large videos directly to Cloudinary, bypassing serverless
// function request size limits and timeouts.
// - The API secret never reaches the client.
// - The URL includes: cloud_name, timestamp, signature, folder, resource_type.
// - URL validity is enforced by Cloudinary's signature timestamp check.
// - Used for: large video uploads where routing through a serverless function
//   would risk 10MB/5MB body limits or timeout issues.

import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { requireApiRole } from "@/lib/server-auth";
import { generateSignedUploadUrl, CLOUDINARY_MAX_VIDEO_BYTES, bufferToBlob } from "@/lib/cloudinary";

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

  let body: {
    filename: string;
    category: (typeof VALID_CATEGORIES)[number];
    fileSize: number;
  } | null = null;

  try {
    const form = await req.formData();
    const fn = form.get("filename");
    const cat = form.get("category");
    const fs = form.get("fileSize");

    if (typeof fn !== "string") return fail("Invalid filename.", 400);
    const fnVal = fn;
    if (typeof cat !== "string") return fail("Invalid category.", 400);
    const catVal = cat;
    if (catVal !== catVal) return fail("Invalid category value.", 400);

    const fileSizeVal = fs ? Number(fs instanceof String ? fs.valueOf() : String(fs)) : 0;
    if (fileSizeVal <= 0) return fail("File size is required.", 400);

    body = {
      filename: fnVal,
      category: catVal as (typeof VALID_CATEGORIES)[number],
      fileSize: fileSizeVal,
    };
  } catch {
    return fail("Invalid form data.", 400);
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(body.category)) {
    return fail(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}.`, 400);
  }

  // Enforce video size limit (100 MB for Cloudinary direct upload)
  if (body.fileSize > CLOUDINARY_MAX_VIDEO_BYTES) {
    return fail(
      `Video exceeds maximum size of ${Math.round(CLOUDINARY_MAX_VIDEO_BYTES / 1024 / 1024)} MB.`,
      400
    );
  }

  // Generate a signed upload URL for direct client upload to Cloudinary.
  // The client will use this URL as the ACTION endpoint for a form POST,
  // attaching the file buffer directly.
  const sigResult = await generateSignedUploadUrl(
    Buffer.from(""), // buffer not needed here; client sends directly
    body.filename,
    body.category,
    { resourceType: "video", fileSize: body.fileSize }
  );

  if (!sigResult.ok) return fail(sigResult.error, 400);

  return ok({
    uploadUrl: sigResult.uploadUrl,
    formFields: sigResult.formFields,
    category: body.category,
    resourceType: "video",
    maxVideoBytes: CLOUDINARY_MAX_VIDEO_BYTES,
    fileSize: body.fileSize,
  });
}