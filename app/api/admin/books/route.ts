// Phase 14 — admin book management (ADMIN only). Full catalogue including
// inactive; students use GET /api/books (active + visibility-filtered).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { resolveCoverUrl, resolveStorageUrl } from "@/lib/storageProvider";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

const VIS = ["ALL", "REGULAR_ONLY"] as const;
const URL_OK = /^(\/uploads\/|https?:\/\/|supabase:\/\/[^/]+\/[^/]+\/.+)/;

function clean(v: unknown, max: number): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  return v.trim().slice(0, max);
}

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading books");
  try {
    const rows = await db.book.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }], take: 500 });
    // Translate durable storage refs into displayable URLs at read time.
    // coverRef/pdfRef carry the raw durable refs so the edit form never
    // round-trips an expiring signed URL back into the database.
    const items = await Promise.all(
      rows.map(async (b) => ({
        ...b,
        coverImageUrl: await resolveCoverUrl(b.coverImageUrl),
        coverRef: b.coverImageUrl,
        pdfUrl: await resolveStorageUrl(b.pdfUrl),
        pdfRef: b.pdfUrl,
      }))
    );
    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("admin-books:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Adding a book");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["title"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  const pdfUrl = clean(body.pdfUrl, 1000);
  const externalUrl = clean(body.externalUrl, 1000);
  if (pdfUrl && !URL_OK.test(pdfUrl)) return fail("Invalid PDF URL.", 400);
  // Signed URLs expire — they are display values, never durable references.
  if (pdfUrl && pdfUrl.includes("/object/sign/")) return fail("Invalid PDF URL.", 400);
  const coverUrl = clean(body.coverImageUrl, 1000);
  if (coverUrl && coverUrl.includes("/object/sign/")) return fail("Invalid cover URL.", 400);
  if (externalUrl && !/^https?:\/\//.test(externalUrl)) return fail("External URL must start with http(s).", 400);
  try {
    const created = await db.book.create({
      data: {
        title: String(body.title).trim().slice(0, 160),
        description: clean(body.description, 2000),
        author: clean(body.author, 120),
        subject: clean(body.subject, 80),
        className: clean(body.className, 40),
        category: clean(body.category, 80),
        coverImageUrl: coverUrl,
        pdfUrl,
        externalUrl,
        visibleTo: VIS.includes(body.visibleTo as (typeof VIS)[number]) ? (body.visibleTo as (typeof VIS)[number]) : "ALL",
        isActive: body.isActive === undefined ? true : body.isActive === true,
        order: typeof body.order === "number" && Number.isFinite(body.order) ? Math.floor(body.order) : 0,
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("admin-books:create", err);
  }
}
