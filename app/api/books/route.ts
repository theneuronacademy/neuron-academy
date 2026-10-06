// Phase 14 — book catalogue. Students see ACTIVE books only, filtered by
// their type (REGULAR_ONLY hidden from scholarship students). Metadata
// only — file bytes are served by storage, never the DB.

import { NextRequest } from "next/server";
import { dbNotConfigured, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { resolveCoverUrl, resolveStorageUrl } from "@/lib/storageProvider";
import { resolveStudent } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Reading books");
  try {
    const params = new URL(req.url).searchParams;
    const search = params.get("search")?.trim() ?? "";
    const className = params.get("class")?.trim() ?? "";
    const subject = params.get("subject")?.trim() ?? "";
    const category = params.get("category")?.trim() ?? "";

    // Scholarship students: ALL-visibility books only. Everyone else
    // (regular students, anonymous website visitors): active books.
    let scholarship = false;
    const viewer = getUserFromRequest(req);
    if (viewer?.role === "STUDENT") {
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      scholarship = !!profile && profile.studentType === "SCHOLARSHIP";
    }
    const rows = await db.book.findMany({
      where: {
        isActive: true,
        ...(scholarship ? { visibleTo: "ALL" as const } : {}),
        ...(search
          ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { author: { contains: search, mode: "insensitive" } }] }
          : {}),
        ...(className ? { className } : {}),
        ...(subject ? { subject } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    const items = await Promise.all(
      rows.map(async (b) => ({
        ...b,
        coverImageUrl: await resolveCoverUrl(b.coverImageUrl),
        pdfUrl: await resolveStorageUrl(b.pdfUrl),
      }))
    );
    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("books:list", err);
  }
}
