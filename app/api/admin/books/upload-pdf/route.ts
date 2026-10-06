// Book-PDF upload (ADMIN only). PDF bytes only; the returned durable
// reference is stored on the book via POST/PATCH book pdfUrl. Filenames are
// regenerated server-side; magic bytes + size enforced.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { saveUpload, validatePdfUpload } from "@/lib/storageProvider";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Uploading a book file");
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
  const problem = validatePdfUpload(buf, file.name);
  if (problem) return fail(problem, 400);
  const saved = await saveUpload("book-pdfs", buf, file.name);
  if (!saved.ok) return fail(saved.error, 502);
  // DB-safe reference in pdfUrl; displayUrl for immediate checks.
  return ok({ pdfUrl: saved.ref, displayUrl: saved.url }, 201);
}
