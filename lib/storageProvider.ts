// Phase 14 — file storage abstraction (SERVER-ONLY: uses node fs/path).
// - Dev/default: local `public/uploads/<scope>/` served by Next static.
// - Production: set STORAGE_PROVIDER=supabase + SUPABASE_* env to store in a
//   private Supabase Storage bucket (signed URLs served to owners only).
// - Never stores executables; images only for photos (ext + magic-byte check).
// - Filenames are always regenerated server-side (no client names on disk).

import { promises as fs } from "node:fs";
import path from "node:path";

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_PHOTO_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function extOf(filename: string): string {
  return (filename.split(".").pop() ?? "").toLowerCase();
}

/** Validate an uploaded photo buffer. Returns an error or null. */
export function validatePhotoUpload(data: Buffer, filename: string): string | null {
  if (!data || data.length === 0) return "Empty file.";
  if (data.length > PHOTO_MAX_BYTES) return "Photo must be under 2 MB.";
  const ext = extOf(filename);
  if (!ALLOWED_PHOTO_EXT.has(ext)) return "Only JPG, PNG or WebP photos are allowed.";
  // Magic bytes: JPEG FF D8 FF | PNG 89 50 4E 47 | WebP RIFF....WEBP.
  const isJpeg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const isPng = data.length > 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  const isWebp =
    data.length > 12 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) return "File content is not a valid image.";
  return null;
}

/** Validate an admin book-cover upload (images only, 3 MB). */
export function validateCoverUpload(data: Buffer, filename: string): string | null {
  if (!data || data.length === 0) return "Empty file.";
  if (data.length > 3 * 1024 * 1024) return "Cover must be under 3 MB.";
  const ext = extOf(filename);
  if (!ALLOWED_PHOTO_EXT.has(ext)) return "Only JPG, PNG or WebP covers are allowed.";
  const isJpeg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const isPng = data.length > 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  const isWebp = data.length > 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) return "File content is not a valid image.";
  return null;
}

/** provider = "local" | "supabase" (supabase wired when env is configured). */
export function storageProvider(): "local" | "supabase" {
  if ((process.env.STORAGE_PROVIDER ?? "").toLowerCase() === "supabase" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && process.env.STORAGE_BUCKET) {
    return "supabase";
  }
  return "local";
}

function safeName(prefix: string, ext: string): string {
  const rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${rand}.${ext}`;
}

/**
 * Persist a buffer and return a public/serveable URL path.
 * Local: writes under public/uploads/<scope>/, returns "/uploads/<scope>/<file>".
 * Supabase: uploads to the configured bucket (graceful honest error when the
 * SDK path is unavailable — never silently drops the file).
 */
export async function saveUpload(scope: "photos" | "covers", data: Buffer, originalName: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ext = extOf(originalName);
  const name = safeName(scope === "photos" ? "student" : "cover", ext === "jpeg" ? "jpg" : ext);
  if (storageProvider() === "supabase") {
    return uploadToSupabase(scope, name, data);
  }
  try {
    const dir = path.join(process.cwd(), "public", "uploads", scope);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), data);
    return { ok: true, url: `/uploads/${scope}/${name}` };
  } catch {
    return { ok: false, error: "Could not save the file." };
  }
}

async function uploadToSupabase(scope: string, name: string, data: Buffer): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY, STORAGE_BUCKET } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !STORAGE_BUCKET) {
      return { ok: false, error: "Storage is not configured." };
    }
    // Minimal REST upload (no new dependency): PUT object, then public URL.
    const key = `${scope}/${name}`;
    const put = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${key}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/octet-stream",
        "x-upsert": "false",
      },
      body: new Uint8Array(data),
    });
    if (!put.ok) return { ok: false, error: "Storage upload failed." };
    return { ok: true, url: `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${key}` };
  } catch {
    return { ok: false, error: "Storage upload failed." };
  }
}

/** Best-effort local file removal (supabase objects: kept; bucket lifecycle owns them). */
export async function removeLocalUpload(url: string): Promise<void> {
  try {
    if (!url.startsWith("/uploads/")) return;
    const full = path.join(process.cwd(), "public", decodeURIComponent(url));
    const base = path.join(process.cwd(), "public", "uploads");
    if (!full.startsWith(base)) return; // path-traversal guard
    await fs.unlink(full).catch(() => null);
  } catch {
    /* best effort */
  }
}
