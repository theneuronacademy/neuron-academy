// Phase 3 — Banners API. Powers: admin banner manager → website carousel.
// Demo fallback when DATABASE_URL is missing.
// TODO auth: writes need ADMIN role once the session layer lands.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { isNonEmpty, missingFields, parseDate } from "@/lib/validation";
import { DEMO_BANNERS } from "@/data/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  if (!db) return ok({ items: DEMO_BANNERS, source: "demo" });
  try {
    const rows = await db.banner.findMany({ orderBy: { displayOrder: "asc" }, take: 100 });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("banners:list", err);
  }
}

export async function POST(req: NextRequest) {
  // Banner flow: admin manager → POST here → PostgreSQL → website carousel.
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating a banner");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["title"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  try {
    const created = await db.banner.create({
      data: {
        title: String(body.title),
        subtitle: typeof body.subtitle === "string" ? body.subtitle : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        imageUrl: isNonEmpty(body.imageUrl ?? body.image) ? String(body.imageUrl ?? body.image) : undefined,
        videoUrl: typeof body.videoUrl === "string" ? body.videoUrl : undefined,
        buttonText: typeof body.buttonText === "string" ? body.buttonText : undefined,
        buttonUrl: typeof body.buttonUrl === "string" ? body.buttonUrl : undefined,
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
        isActive: typeof body.isActive === "boolean" ? body.isActive : body.active === true,
        displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : typeof body.order === "number" ? body.order : 0,
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("banners:create", err);
  }
}
