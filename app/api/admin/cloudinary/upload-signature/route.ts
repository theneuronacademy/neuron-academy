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
import { generateSignedUploadUrl, CLOUDINARY_MAX_IMAGE_BYTES, CLOUDINARY_MAX_VIDEO_BYTES } from "@/lib/cloudinary";

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

  let body: {
    filename: string;
    category: (typeof VALID_CATEGORIES)[number];
    resourceType?: "image" | "video";
    fileSize?: number;
  } | null = null;

  try {
    const form = await req.formData();
    const fn = form.get("filename");
    const cat = form.get("category");
    const rt = form.get("resourceType");
    const fs = form.get("fileSize");

    if (typeof fn !== "string") return fail("Invalid filename.", 400);
    const fnVal = fn;
    if (typeof cat !== "string") return fail("Invalid category.", 400);
    const catVal = cat;
    if (catVal !== catVal) return fail("Invalid category value.", 400);

    const fileSizeVal = fs ? Number(fs instanceof String ? fs.valueOf() : String(fs)) : undefined;

    body = {
      filename: fnVal,
      category: catVal as (typeof VALID_CATEGORIES)[number],
      resourceType: rt?.toString() as "image" | "video" | undefined,
      fileSize: fileSizeVal,
    };
  } catch {
    return fail("Invalid form data.", 400);
  }

  if (!body) return fail("No body provided.", 400);

  // Validate category
  if (!VALID_CATEGORIES.includes(body.category)) {
    return fail(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}.`, 400);
  }

  // We cannot read the file buffer here because this route only generates a signature.
  // The actual upload happens client‑directly to Cloudinary using the signed URL.
  // However, we do a quick size sanity check on the reported size.
  if (body.fileSize !== undefined) {
    const maxBytes = body.resourceType === "video"
      ? CLOUDINARY_MAX_VIDEO_BYTES
      : CLOUDINARY_MAX_IMAGE_BYTES;
    if (body.fileSize > maxBytes) {
      return fail(
        `File exceeds maximum size of ${Math.round(maxBytes / 1024 / 1024)} MB.`,
        400
      );
    }
  }

  // Generate the signed upload URL that the client will POST to
  const sigResult = await generateSignedUploadUrl(
    Buffer.from(""), // placeholder — actual buffer sent by client to Cloudinary
    body.filename,
    body.category,
    { resourceType: body.resourceType, fileSize: body.fileSize }
  );

  if (!sigResult.ok) return fail(sigResult.error, 400);

  // Return the signed URL and form fields for the client to use
  return ok({
    uploadUrl: sigResult.uploadUrl,
    formFields: sigResult.formFields,
    category: body.category,
    resourceType: body.resourceType,
    maxImageBytes: CLOUDINARY_MAX_IMAGE_BYTES,
    maxVideoBytes: CLOUDINARY_MAX_VIDEO_BYTES,
  });
}