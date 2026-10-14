// Phase 3 — Gallery API. Demo fallback from public gallery when DB is missing.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { getUserFromRequest } from "@/lib/session";
import { missingFields } from "@/lib/validation";
import { GALLERY } from "@/data/gallery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) {
    return ok({
      items: GALLERY.map((g, i) => ({ id: g.id, title: g.title, description: null, imageUrl: g.image, category: g.category, displayOrder: i, isActive: true })),
      source: "demo",
    });
  }
  // Phase 17 — ADMIN sees all gallery items; others only active ones.
  const viewer = getUserFromRequest(req);
  try {
    const rows = await db.galleryItem.findMany({
      where: viewer?.role === "ADMIN" ? {} : { isActive: true },
      orderBy: { displayOrder: "asc" },
      take: 200,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("gallery:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Adding a gallery photo");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["title", "imageUrl"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  try {
    const created = await db.galleryItem.create({
      data: {
        title: String(body.title),
        description: typeof body.description === "string" ? body.description : undefined,
        imageUrl: String(body.imageUrl),
        category: typeof body.category === "string" ? body.category : "Academy",
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("gallery:create", err);
  }
}
