// Cloudinary direct upload proxy (ADMIN only).
// POST /api/admin/cloudinary/upload
// Proxies file uploads through our server to Cloudinary, avoiding CORS issues
// that occur when browsers upload directly to Cloudinary's upload endpoint.
// The server uploads to Cloudinary server-to-server, so no CORS configuration
// is needed in the Cloudinary dashboard.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { uploadToCloudinary, CLOUDINARY_MAX_IMAGE_BYTES, CLOUDINARY_MAX_VIDEO_BYTES } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Allowed categories map to neuron-academy/ folders
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

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Uploading to Cloudinary");

  let body: {
    filename: string;
    category: (typeof VALID_CATEGORIES)[number];
    resourceType: "image" | "video";
    file: File;
  } | null = null;

  try {
    const form = await req.formData();
    const fn = form.get("filename");
    const cat = form.get("category");
    const rt = form.get("resourceType");
    const file = form.get("file");

    if (typeof fn !== "string") return fail("Invalid filename.", 400);
    if (typeof cat !== "string") return fail("Invalid category.", 400);
    if (!(file instanceof File)) return fail("No file provided.", 400);

    body = {
      filename: fn,
      category: cat as (typeof VALID_CATEGORIES)[number],
      resourceType: (rt?.toString() as "image" | "video") ?? "image",
      file,
    };
  } catch {
    return fail("Invalid form data.", 400);
  }

  if (!body) return fail("No body provided.", 400);

  // Validate category
  if (!VALID_CATEGORIES.includes(body.category)) {
    return fail(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}.`, 400);
  }

  // Read file buffer
  const buffer = Buffer.from(await body.file.arrayBuffer());

  // Validate file size
  const maxBytes = body.resourceType === "video"
    ? CLOUDINARY_MAX_VIDEO_BYTES
    : CLOUDINARY_MAX_IMAGE_BYTES;
  if (buffer.length > maxBytes) {
    return fail(`File exceeds maximum size of ${Math.round(maxBytes / 1024 / 1024)} MB.`, 400);
  }

  // Upload to Cloudinary server-to-server (no CORS issues)
  const result = await uploadToCloudinary(buffer, body.file.name, body.category, {
    resourceType: body.resourceType,
  });

  if (!result.ok) {
    return fail(result.error ?? "Cloudinary upload failed.", 400);
  }

  return ok({
    url: result.url,
    publicId: result.publicId,
    resourceType: result.resourceType,
    width: result.width,
    height: result.height,
    duration: result.duration,
  });
}
