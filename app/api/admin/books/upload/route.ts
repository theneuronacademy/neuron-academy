// Phase 14 — admin book-cover upload (ADMIN only). Images only; the
// returned URL is stored on the book via PATCH /api/admin/books/[id].

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { saveUpload, validateCoverUpload } from "@/lib/storageProvider";

export const dynamic = "force-dynamic";
// Vercel: image bytes are staged via node:fs/path (storageProvider local
// mode), so this route requires the Node.js runtime — never Edge.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Uploading a cover");
  let file: File | null = null;
  try {
    const form = await req.formData();
    const v = form.get("file");
    if (v instanceof File) file = v;
  } catch {
    return fail("Invalid upload.", 400);
  }
  if (!file) return fail("No file provided.", 400);
  const buf = Buffer.from(await file.arrayBuffer());
  const problem = validateCoverUpload(buf, file.name);
  if (problem) return fail(problem, 400);
  const saved = await saveUpload("covers", buf, file.name);
  if (!saved.ok) return fail(saved.error, saved.code === "STORAGE_NOT_CONFIGURED" ? 503 : 502);
  // DB-safe reference in coverImageUrl; displayUrl for immediate preview.
  // The admin UI PATCHes coverImageUrl (the durable ref) onto the book.
  return ok({ coverImageUrl: saved.ref, displayUrl: saved.url }, 201);
}
