// File storage abstraction (SERVER-ONLY: uses node fs/path + service key).
// Contract: upload / resolve-display-URL / delete, with honest errors.
// - Dev/default (STORAGE_PROVIDER=local): files under public/uploads/<scope>/,
//   served by Next static. Ephemeral on serverless — never rely on it in prod.
// - Production (STORAGE_PROVIDER=supabase + SUPABASE_URL + SUPABASE_SERVICE_KEY
//   + STORAGE_BUCKET): objects in a PRIVATE Supabase Storage bucket.
//   The database stores key-form references `supabase://<bucket>/<key>` (never
//   local paths, never expiring signed URLs). Read paths translate refs into
//   short-lived signed URLs server-side; the service key never leaves the
//   server and never appears in API responses.
// Bucket policy (documented choice): private bucket for everything. Book
// covers are the one public asset — they are served through long-lived
// (7-day) signed URLs generated at read time, never a public bucket.
// - Never stores executables; images + PDFs only (ext + magic-byte check).
// - Filenames are always regenerated server-side (no client names on disk).

import { promises as fs } from "node:fs";
import path from "node:path";

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const COVER_MAX_BYTES = 3 * 1024 * 1024;
export const PDF_MAX_BYTES = 10 * 1024 * 1024;
/** Covers are hot-linked by cards/lists: 7 days. Photos/PDFs: 1 hour. */
export const COVER_URL_TTL_SEC = 7 * 24 * 3600;
export const PRIVATE_URL_TTL_SEC = 3600;

const ALLOWED_PHOTO_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_PDF_EXT = new Set(["pdf"]);

export type UploadScope = "photos" | "covers" | "book-pdfs";

function extOf(filename: string): string {
  return (filename.split(".").pop() ?? "").toLowerCase();
}

function isImageBytes(data: Buffer): boolean {
  const isJpeg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const isPng = data.length > 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  const isWebp =
    data.length > 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  return isJpeg || isPng || isWebp;
}

/** Validate an uploaded photo buffer. Returns an error or null. */
export function validatePhotoUpload(data: Buffer, filename: string): string | null {
  if (!data || data.length === 0) return "Empty file.";
  if (data.length > PHOTO_MAX_BYTES) return "Photo must be under 2 MB.";
  const ext = extOf(filename);
  if (!ALLOWED_PHOTO_EXT.has(ext)) return "Only JPG, PNG or WebP photos are allowed.";
  if (!isImageBytes(data)) return "File content is not a valid image.";
  return null;
}

/** Validate an admin book-cover upload (images only, 3 MB). */
export function validateCoverUpload(data: Buffer, filename: string): string | null {
  if (!data || data.length === 0) return "Empty file.";
  if (data.length > COVER_MAX_BYTES) return "Cover must be under 3 MB.";
  const ext = extOf(filename);
  if (!ALLOWED_PHOTO_EXT.has(ext)) return "Only JPG, PNG or WebP covers are allowed.";
  if (!isImageBytes(data)) return "File content is not a valid image.";
  return null;
}

/** Validate an admin book-PDF upload (PDF only, 10 MB, %PDF- magic). */
export function validatePdfUpload(data: Buffer, filename: string): string | null {
  if (!data || data.length === 0) return "Empty file.";
  if (data.length > PDF_MAX_BYTES) return "PDF must be under 10 MB.";
  if (extOf(filename) !== "pdf" && !ALLOWED_PDF_EXT.has(extOf(filename))) return "Only PDF files are allowed.";
  const isPdf = data.length > 5 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46 && data[4] === 0x2d;
  if (!isPdf) return "File content is not a valid PDF.";
  return null;
}

/** provider = "local" | "supabase" (supabase wired when env is configured). */
export function storageProvider(): "local" | "supabase" {
  if (
    (process.env.STORAGE_PROVIDER ?? "").toLowerCase() === "supabase" &&
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_KEY &&
    process.env.STORAGE_BUCKET
  ) {
    return "supabase";
  }
  return "local";
}

function safeName(prefix: string, ext: string): string {
  const rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${rand}.${ext}`;
}

function scopePrefix(scope: UploadScope): string {
  if (scope === "photos") return "student";
  if (scope === "covers") return "cover";
  return "bookpdf";
}

/** Parse a `supabase://<bucket>/<key>` reference. Null when not key-form. */
export function parseStorageRef(
  value: string | null | undefined
): { bucket: string; key: string; scope: string } | null {
  if (typeof value !== "string" || !value.startsWith("supabase://")) return null;
  const rest = value.slice("supabase://".length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const key = rest.slice(slash + 1);
  if (!bucket || !key) return null;
  if (key.includes("..") || key.includes("\\") || key.startsWith("/") || /[\0-\x1f\x7f]/.test(key)) return null;
  const scope = key.split("/")[0] ?? "";
  if (scope !== "photos" && scope !== "covers" && scope !== "book-pdfs") return null;
  return { bucket, key, scope };
}

function supabaseEnv(): { url: string; key: string; bucket: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const bucket = process.env.STORAGE_BUCKET;
  if (!url || !key || !bucket) return null;
  return { url: url.replace(/\/$/, ""), key, bucket };
}

/**
 * Persist a buffer.
 * Returns the durable DB reference (`ref`) plus an immediately displayable
 * URL. Local: ref and url are both `/uploads/<scope>/<file>`. Supabase:
 * ref is `supabase://<bucket>/<key>` and url is a signed URL.
 */
export async function saveUpload(
  scope: UploadScope,
  data: Buffer,
  originalName: string
): Promise<{ ok: true; ref: string; url: string } | { ok: false; error: string }> {
  const rawExt = extOf(originalName);
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;
  const name = safeName(scopePrefix(scope), ext);
  const key = `${scope}/${name}`;
  if (storageProvider() === "supabase") {
    const env = supabaseEnv();
    if (!env) return { ok: false, error: "Storage is not configured." };
    try {
      // Official Storage REST: PUT object (upsert disabled — names are unique).
      const put = await fetch(`${env.url}/storage/v1/object/${env.bucket}/${key}`, {
        method: "PUT",
        headers: {
          apikey: env.key,
          Authorization: `Bearer ${env.key}`,
          "Content-Type": "application/octet-stream",
          "x-upsert": "false",
        },
        body: new Uint8Array(data),
      });
      if (!put.ok) return { ok: false, error: "Storage upload failed." };
      const ref = `supabase://${env.bucket}/${key}`;
      const signed = await signStorageKey(env.bucket, key, PRIVATE_URL_TTL_SEC);
      if (!signed.ok) return { ok: false, error: "Storage upload failed." };
      return { ok: true, ref, url: signed.url };
    } catch {
      return { ok: false, error: "Storage upload failed." };
    }
  }
  try {
    const dir = path.join(process.cwd(), "public", "uploads", scope);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), data);
    const url = `/uploads/${scope}/${name}`;
    return { ok: true, ref: url, url };
  } catch {
    return { ok: false, error: "Could not save the file." };
  }
}

/** Sign a bucket key. Server-only (service key); returns a bearer URL string. */
export async function signStorageKey(
  bucket: string,
  key: string,
  expiresInSec: number
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const env = supabaseEnv();
  if (!env) return { ok: false, error: "Storage is not configured." };
  if (bucket !== env.bucket) return { ok: false, error: "Unknown storage bucket." };
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) return { ok: false, error: "Invalid storage key." };
  try {
    const res = await fetch(`${env.url}/storage/v1/object/sign/${bucket}/${key}`, {
      method: "POST",
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: expiresInSec }),
    });
    if (!res.ok) return { ok: false, error: "File not available." };
    const json = (await res.json().catch(() => null)) as { signedURL?: string } | null;
    const signed = typeof json?.signedURL === "string" ? json.signedURL : null;
    if (!signed) return { ok: false, error: "File not available." };
    return { ok: true, url: signed.startsWith("http") ? signed : `${env.url}${signed.startsWith("/") ? "" : "/"}${signed}` };
  } catch {
    return { ok: false, error: "File not available." };
  }
}

/**
 * Translate a stored reference into a displayable URL.
 * - `supabase://` refs → fresh signed URL (ttlSec; covers default to the
 *   long public-asset TTL via resolveCoverUrl). Unresolvable → null.
 * - local `/uploads/…` paths and remote `https://` URLs pass through.
 */
export async function resolveStorageUrl(
  stored: string | null | undefined,
  ttlSec: number = PRIVATE_URL_TTL_SEC
): Promise<string | null> {
  if (!stored) return null;
  const parsed = parseStorageRef(stored);
  if (!parsed) return stored;
  const signed = await signStorageKey(parsed.bucket, parsed.key, ttlSec);
  return signed.ok ? signed.url : null;
}

/** Cover display URL (public asset: long-lived signed URL at read time). */
export async function resolveCoverUrl(stored: string | null | undefined): Promise<string | null> {
  return resolveStorageUrl(stored, COVER_URL_TTL_SEC);
}

/**
 * Delete a stored object. Accepts key-form refs and local `/uploads/…`
 * paths; anything else is a no-op returning true (nothing owned to delete).
 * Returns false ONLY when a Supabase delete was attempted and failed, so
 * callers can refuse to pretend cleanup succeeded.
 */
export async function deleteStorageObject(refOrUrl: string | null | undefined): Promise<boolean> {
  if (!refOrUrl) return true;
  const parsed = parseStorageRef(refOrUrl);
  if (parsed) {
    const env = supabaseEnv();
    if (!env || parsed.bucket !== env.bucket) return false;
    try {
      const res = await fetch(`${env.url}/storage/v1/object/${parsed.bucket}/${parsed.key}`, {
        method: "DELETE",
        headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  if (!refOrUrl.startsWith("/uploads/")) return true;
  try {
    const full = path.join(process.cwd(), "public", decodeURIComponent(refOrUrl));
    const base = path.join(process.cwd(), "public", "uploads");
    if (!full.startsWith(base)) return true; // path-traversal guard: not ours
    await fs.unlink(full).catch(() => null);
    return true;
  } catch {
    return true; // ephemeral local FS: linkage removal is authoritative
  }
}
