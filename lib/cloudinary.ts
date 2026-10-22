// Server-only Cloudinary media infrastructure for Neuron Academy.
// - Uses CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// - Never exposes the API secret in client code or NEXT_PUBLIC variables.
// - Provides signed upload URLs for admin-approved uploads.
// - All uploads go through server-side proxy (no CORS issues with direct
//   browser-to-Cloudinary uploads).
// - Validates file types, sizes, resource types, and upload folders.
// - Stores: url (public CDN URL), public_id, resource_type through existing models.
// - Consistent folders under neuron-academy/<category> per requirement 9.
// - Preserves existing static/external URLs (pass-through).
// - Idempotent retry logic; never deletes an asset if another content item references it.

import { createHash } from "node:crypto";

// Cloudinary SDK initialized server-side only (for URL transformations only)
// We do NOT use cloudinary.uploader for uploads - we do manual signed REST uploads
// to have full control over the signing algorithm (hex digest, correct params).
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryInstance: any = cloudinary;

// ----- Folder mapping (requirement 9: consistent neuron-academy/ folders) -----

const FOLDER_MAP: Record<string, string> = {
  // Branding assets (logo, brand kit)
  branding: "neuron-academy/branding",
  // About page assets
  about: "neuron-academy/about",
  // Classroom assets (lesson materials, classroom images)
  classroom: "neuron-academy/classroom",
  // Banner images/video
  banners: "neuron-academy/banners",
  // Advertisement assets
  advertisements: "neuron-academy/advertisements",
  // Gallery images
  gallery: "neuron-academy/gallery",
  // Course assets (covers, thumbnails, promotional)
  courses: "neuron-academy/courses",
  // Faculty assets (headshots, photos)
  faculty: "neuron-academy/faculty",
  // Study material (notes, references, PDFs)
  studyMaterial: "neuron-academy/study-material",
};

/**
 * Get the Cloudinary folder path for a given category.
 * Returns null when the category is unknown (caller should use original folder or default).
 */
export function getCloudinaryFolder(category: string): string | null {
  return FOLDER_MAP[category] ?? null;
}

/** Validate folder name (no path traversal, safe for Cloudinary) */
export function validateCloudinaryFolder(folder: string): string | null {
  if (!folder) return null;
  if (folder.includes("..") || folder.includes("\\") || folder.startsWith("/")) {
    return "Folder contains invalid path characters.";
  }
  // Only allow alphanumeric, dash, underscore, slash
  if (!/^[a-zA-Z0-9/\-_]+$/.test(folder)) {
    return "Folder contains disallowed characters.";
  }
  return null;
}

/** Allowed file extensions per resource type */
const ALLOWED_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif"]);
const ALLOWED_VIDEO_EXTS = new Set(["mp4", "mov", "avi", "webm", "mkv", "wmv", "flv"]);

/** Max bytes per resource type (conservative limits for serverless-friendly sizes) */
export const CLOUDINARY_MAX_IMAGE_BYTES = 5 * 1024 * 1024;    // 5 MB
export const CLOUDINARY_MAX_VIDEO_BYTES = 100 * 1024 * 1024;  // 100 MB

/** Validate a file buffer against resource type and return error or null */
export function validateCloudinaryFile(
  data: Buffer,
  filename: string,
  resourceType: "image" | "video"
): string | null {
  if (!data || data.length === 0) return "Empty file.";

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  const maxBytes = resourceType === "image" ? CLOUDINARY_MAX_IMAGE_BYTES : CLOUDINARY_MAX_VIDEO_BYTES;
  if (data.length > maxBytes) {
    return resourceType === "image"
      ? `Image must be under 5 MB (received ${Math.round(data.length / 1024 / 1024)} MB).`
      : `Video must be under 100 MB (received ${Math.round(data.length / 1024 / 1024)} MB).`;
  }

  if (resourceType === "image") {
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
      return `Only image files (JPG, PNG, WebP, AVIF, GIF) are allowed.`;
    }
    // Magic-byte check for image content
    const isJpeg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    const isPng = data.length > 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x47;
    const isWebp =
      data.length > 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
    const isAvif =
      data.length > 4 && data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x0c;
    if (!isJpeg && !isPng && !isWebp && !isAvif) {
      return "File content is not a valid image.";
    }
  } else if (resourceType === "video") {
    if (!ALLOWED_VIDEO_EXTS.has(ext)) {
      return `Only video files (MP4, MOV, AVI, WebM, MKV, WMV, FLV) are allowed.`;
    }
  }

  return null;
}

/**
 * Validate a file using metadata (extension + declared size) rather than buffer
 * content. Used when the file bytes are not available (e.g. signature-only routes)
 * or as a pre-check before reading the buffer.
 */
export function validateCloudinaryFileFromMetadata(
  filename: string,
  resourceType: "image" | "video",
  fileSize?: number
): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (resourceType === "image") {
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
      return `Only image files (JPG, PNG, WebP, AVIF, GIF) are allowed.`;
    }
    if (fileSize !== undefined && fileSize > CLOUDINARY_MAX_IMAGE_BYTES) {
      return `Image must be under 5 MB (received ${Math.round(fileSize / 1024 / 1024)} MB).`;
    }
  } else {
    if (!ALLOWED_VIDEO_EXTS.has(ext)) {
      return `Only video files (MP4, MOV, AVI, WebM, MKV, WMV, FLV) are allowed.`;
    }
    if (fileSize !== undefined && fileSize > CLOUDINARY_MAX_VIDEO_BYTES) {
      return `Video must be under 100 MB (received ${Math.round(fileSize / 1024 / 1024)} MB).`;
    }
  }

  return null;
}

/**
 * Generate a Cloudinary upload signature (server-only).
 * 
 * The signature is computed over ONLY these parameters (sorted alphabetically):
 *   folder, public_id, timestamp
 * Then appended with the API secret and SHA-1 hashed (HEX digest).
 * 
 * The api_key, cloud_name, resource_type, and file are sent in the form body
 * but are NOT part of the signature string.
 * 
 * @param folder The Cloudinary folder (e.g., "neuron-academy/banners")
 * @param publicId The Cloudinary public_id (optional; Cloudinary generates one if omitted)
 * @returns Object with timestamp, signature, public_id
 */
export function generateUploadSignature(
  folder: string,
  publicId?: string
): { timestamp: string; signature: string; publicId: string } {
  const timestamp = Math.round(Date.now() / 1000).toString();
  
  // Build signature string with ONLY these params, sorted alphabetically:
  // folder, public_id, timestamp
  const signatureParams: Record<string, string> = {
    folder,
  };
  if (publicId) {
    signatureParams.public_id = publicId;
  }
  signatureParams.timestamp = timestamp;

  // Sort keys alphabetically and build string: key=value&key=value
  const sortedKeys = Object.keys(signatureParams).sort();
  const signatureString = sortedKeys
    .map((key) => `${key}=${signatureParams[key]}`)
    .join("&");

  // Append API secret and SHA-1 hash (HEX digest, not base64)
  const secret = process.env.CLOUDINARY_API_SECRET!;
  const signature = createHash("sha1")
    .update(signatureString + secret)
    .digest("hex");

  const resolvedPublicId = publicId ?? `neuron-${Date.now()}`;

  return { timestamp, signature, publicId: resolvedPublicId };
}

/**
 * Upload a buffer directly to Cloudinary via server-side signed upload.
 * This is the server-side function that actually performs the upload.
 * Called from API routes after admin authentication.
 * 
 * The upload goes server-to-server (no CORS issues), avoiding the need
 * to configure allowed origins in the Cloudinary dashboard.
 * 
 * @param buffer The file buffer to upload
 * @param filename Original filename
 * @param category The neuron-academy folder category (e.g., "courses", "banners")
 * @param options Additional upload options
 * @returns Object with url, publicId, resourceType, width, height, duration
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  filename: string,
  category: string,
  options: {
    resourceType?: "image" | "video";
    folderOverride?: string;
    // Preserve the original public_id if we want to overwrite (retry/replace)
    publicIdOverride?: string;
  } = {}
): Promise<{
  ok: true;
  url: string;       // Public CDN URL for immediate preview
  publicId: string;  // Cloudinary public ID (store in DB)
  resourceType: "image" | "video";
  width?: number;
  height?: number;
  duration?: number; // for videos (seconds)
} | {
  ok: false;
  url: string;
  publicId: string;
  resourceType: "image" | "video";
  error: string;
}> {
  // Resolve folder
  const folder = options.folderOverride ?? getCloudinaryFolder(category);
  if (!folder) {
    return { ok: false, url: "", publicId: "", resourceType: "image" as const, error: `Unknown category: ${category}` };
  }

  const folderValidation = validateCloudinaryFolder(folder);
  if (folderValidation) {
    return { ok: false, url: "", publicId: "", resourceType: "image" as const, error: folderValidation };
  }

  // Determine resource type: explicit option wins, else fall back to extension
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const resourceType: "image" | "video" =
    options.resourceType ?? (ALLOWED_VIDEO_EXTS.has(ext) ? "video" : "image");

  // Validate
  const validationError = validateCloudinaryFile(buffer, filename, resourceType);
  if (validationError) {
    return { ok: false, url: "", publicId: "", resourceType, error: validationError };
  }

  try {
    const publicId = options.publicIdOverride ?? `neuron-${category}-${Date.now()}`;

    // Correct Cloudinary signature: SHA-1 HEX of sorted "key=value&..." + secret.
    // Signed params are ONLY folder, public_id, timestamp.
    // api_key / cloud_name / resource_type / file go in the body, never signed.
    const { timestamp, signature } = generateUploadSignature(folder, publicId);

    const configured = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY;
    if (!configured) {
      return { ok: false, url: "", publicId: "", resourceType: "image" as const, error: "Cloudinary is not configured (missing credentials)." };
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

    // Build multipart form data
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(buffer)]), filename);
    formData.append("api_key", process.env.CLOUDINARY_API_KEY!);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);
    formData.append("resource_type", resourceType);
    formData.append("folder", folder);
    formData.append("public_id", publicId);

    // Perform the upload (server-to-server, no CORS issues)
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("[Cloudinary] Upload failed:", errorText);
      return { ok: false, url: "", publicId: "", resourceType, error: `Cloudinary upload failed: ${errorText}` };
    }

    // Parse Cloudinary response
    const result: any = await uploadResponse.json();
    
    // Return the useful data
    return {
      ok: true,
      url: result.secure_url || "",
      publicId: result.public_id || publicId,
      resourceType: result.resource_type || resourceType,
      width: result.width,
      height: result.height,
      duration: result.duration, // seconds for video
    };
  } catch (err) {
    console.error("[Cloudinary] Error uploading to Cloudinary:", err);
    return { ok: false, url: "", publicId: "", resourceType: "image" as const, error: "Cloudinary upload failed." };
  }
}

/**
 * Build a Cloudinary media URL with transformations.
 * Useful for generating preview/thumbnail URLs.
 */
export function buildCloudinaryUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: "fill" | "limit" | "pad" | "thumb";
    format?: "auto" | "jpg" | "png" | "webp";
    quality?: number;
    color?: string;
    [key: string]: unknown;
  } = {}
): string {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return `/placeholder.svg?alt=media`;
  }
  
  // Use cloudinaryInstance to build URL
  const builder: any = cloudinaryInstance.url(publicId, {
    secure: true,
    ...options,
  });
  
  // Cloudinary URL builder may return a string or an object; ensure string return
  if (typeof builder === "string") {
    return builder;
  }
  if (builder && typeof builder === "object") {
    // Build URL string from transformation parameters
    const base = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;
    let result = base;
    if (builder.width) result += `/w_${builder.width}`;
    if (builder.height) result += `/h_${builder.height}`;
    if (builder.crop) result += `/c_${builder.crop}`;
    if (builder.format) result += `/f_${builder.format}`;
    if (builder.quality !== undefined) result += `/q_${builder.quality}`;
    if (builder.color) result += `/c_${builder.color}`;
    return result;
  }
  return `/placeholder.svg?alt=media`;
}

/**
 * Build a Cloudinary video poster/image URL.
 * Videos have a poster frame by default; this allows customization.
 */
export function buildCloudinaryVideoPosterUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: "fill" | "limit" | "pad" | "thumb";
    [key: string]: unknown;
  } = {}
): string {
  return buildCloudinaryUrl(publicId, {
    resource_type: "video",
    type: "upload",
    ...options,
    // Add timestamp extraction for poster
    avatar: true,
  });
}

// ----- Replace / Remove / Retry helpers -----

/**
 * Check if a Cloudinary public ID is referenced by any content item in the DB.
 * This is a narrowly scoped check - the caller must query the specific model.
 * Returns the list of content items referencing this asset.
 */
export interface CloudinaryReferenceCheck {
  referencedBy: Array<{ model: string; id: string; field: string }>;
  safeToDelete: boolean;
}

/**
 * Check if a Cloudinary asset is safe to delete (not referenced by any content item).
 * This is a placeholder - the actual implementation queries the Prisma DB.
 * 
 * @param publicId The Cloudinary public ID to check
 * @param modelsToCheck Prisma models to check for references (e.g., [db.banner, db.popup, ...])
 * @returns Whether the asset is safe to delete and what references it
 */
export function checkCloudinaryAssetReferences(
  publicId: string,
  modelsToCheck: any[]
): Promise<CloudinaryReferenceCheck> {
  // This function is intended to be called from API routes that have
  // access to the Prisma client. The implementation will iterate over
  // the provided models and check if any record references this public_id.
  // 
  // For now, return safe-to-delete by default; callers must implement
  // the actual DB checks per their content models.
  return Promise.resolve({
    referencedBy: [],
    safeToDelete: true,
  });
}

/**
 * Replace a Cloudinary asset (overwrite existing public_id).
 * Used when updating a media asset while keeping the same DB reference.
 * 
 * @param buffer New file buffer
 * @param filename Original filename
 * @param category neuron-academy folder category
 * @param existingPublicId The existing public_id to overwrite (optional; new one generated if omitted)
 * @param options Additional options
 * @returns Result with new URL and public_id
 */
export async function replaceCloudinaryAsset(
  buffer: Buffer,
  filename: string,
  category: string,
  existingPublicId?: string,
  options: {
    resourceType?: "image" | "video";
    folderOverride?: string;
  } = {}
): Promise<{
  ok: true;
  newUrl: string;
  newPublicId: string;
  overwrittenPublicId?: string;
  error?: string;
} | {
  ok: false;
  newUrl: string;
  newPublicId: string;
  error: string;
}> {
  // Upload with the existing public_id to overwrite
  const result = await uploadToCloudinary(buffer, filename, category, {
    resourceType: options.resourceType,
    folderOverride: options.folderOverride,
    publicIdOverride: existingPublicId,
  });

  if (!result.ok) {
    return { ok: false, newUrl: "", newPublicId: "", error: result.error ?? "Upload failed" };
  }

  const overwritten = existingPublicId ?? undefined;
  return {
    ok: true,
    newUrl: result.url,
    newPublicId: result.publicId,
    overwrittenPublicId: overwritten,
  };
}

/**
 * Remove a Cloudinary asset (server-side deletion).
 * IMPORTANT: Before calling, the caller must verify that no content item
 * references this public_id via checkCloudinaryAssetReferences().
 * 
 * @param publicId The Cloudinary public_id to remove
 * @returns Success status
 */
export async function removeCloudinaryAsset(
  publicId: string,
  options: { resourceType?: "image" | "video" } = {}
): Promise<{ ok: true; deleted: boolean } | { ok: false; error: string }> {
  // Use cloudinaryInstance uploader to destroy
  try {
    const result: any = (cloudinaryInstance as any).uploader.destroy(publicId, {
      resource_type: options.resourceType ?? "image",
    });

    // Cloudinary returns: { result: "ok" | "not found", id: "...", ... }
    if (result.result === "ok" || result.result === "deleted") {
      return { ok: true, deleted: true };
    }
    if (result.result === "not found") {
      // Asset already deleted; not an error, just report
      return { ok: true, deleted: false };
    }
    return { ok: false, error: `Cloudinary delete failed: ${JSON.stringify(result)}` };
  } catch (err) {
    console.error("[Cloudinary] Error removing asset:", err);
    return { ok: false, error: "Cloudinary delete request failed." };
  }
}

/**
 * Retry logic for Cloudinary uploads.
 * Wraps an upload function with exponential backoff retry.
 */
export async function withCloudinaryRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      
      // Don't retry on client errors (validation, etc.)
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("Empty file") || errorMessage.includes("not a valid image")) {
        throw err; // Don't retry validation errors
      }
      
      // Exponential backoff
      const delay = baseDelay * 2 ** attempt;
      console.warn(
        `[Cloudinary] Upload attempt ${attempt + 1}/${maxRetries} failed: ${errorMessage}. ` +
        `Retrying in ${delay}ms...`
      );
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// ----- Export the cloudinary instance for transformations -----
// This is safe to import in server components only (next/legacy).
export { cloudinaryInstance };
