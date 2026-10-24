// Phase 3 — Banners API. Powers: admin banner manager → website carousel.
// Demo fallback when DATABASE_URL is missing.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { getUserFromRequest } from "@/lib/session";
import { isNonEmpty, missingFields, parseDate } from "@/lib/validation";
import { DEMO_BANNERS } from "@/data/admin";
import { isBannerAnimation, toBannerAnimation } from "@/components/website/bannerMotion";

export const dynamic = "force-dynamic";

/** Normalize raw driver timestamp values into ISO strings. */
function toIso(v: unknown): string {
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * listBanners — plain findMany returns every scalar field, which needs the
 * `animation` column to exist. Until the additive banner-animation migration
 * is deployed (P2022: column missing), retry with an explicit select and
 * default the animation to "none" so the list keeps working either way.
 */
async function listBanners(db: import("@prisma/client").PrismaClient) {
  try {
    return await db.banner.findMany({ orderBy: { displayOrder: "asc" }, take: 100 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (!msg.includes("P2022") && !msg.toLowerCase().includes("animation")) throw err;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (db as any).banner.findMany({
      select: {
        id: true, title: true, subtitle: true, description: true,
        imageUrl: true, videoUrl: true, buttonText: true, buttonUrl: true,
        startDate: true, endDate: true, isActive: true, displayOrder: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { displayOrder: "asc" },
      take: 100,
    });
    return rows.map((r: Record<string, unknown>) => ({ ...r, animation: "none" }));
  }
}

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return ok({ items: DEMO_BANNERS, source: "demo" });
  // Phase 17 — ADMIN manages the full catalogue (incl. drafts/inactive);
  // everyone else sees only active, in-window banners (no draft disclosure).
  const viewer = getUserFromRequest(req);
  const now = new Date();
  try {
    const rows = await listBanners(db);
    const visible =
      viewer?.role === "ADMIN"
        ? rows
        : rows.filter(
            (b: { isActive?: boolean; startDate?: Date | null; endDate?: Date | null }) =>
              b.isActive === true &&
              (b.startDate == null || b.startDate <= now) &&
              (b.endDate == null || b.endDate >= now)
          );
    return ok({ items: visible, source: "database" });
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
  const wantsAnimation = typeof body.animation === "string" && body.animation !== "none";
  const animation = wantsAnimation ? toBannerAnimation(body.animation) : "none";
  try {
    const created = await db.banner.create({ data: wantsAnimation
        ? {
            title: String(body.title),
            subtitle: typeof body.subtitle === "string" ? body.subtitle : undefined,
            description: typeof body.description === "string" ? body.description : undefined,
            imageUrl: isNonEmpty(body.imageUrl ?? body.image) ? String(body.imageUrl ?? body.image) : undefined,
            videoUrl: typeof body.videoUrl === "string" ? body.videoUrl : undefined,
            buttonText: typeof body.buttonText === "string" ? body.buttonText : undefined,
            buttonUrl: typeof body.buttonUrl === "string" ? body.buttonUrl : undefined,
            animation,
            startDate: parseDate(body.startDate),
            endDate: parseDate(body.endDate),
            isActive: typeof body.isActive === "boolean" ? body.isActive : body.active === true,
            displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : typeof body.order === "number" ? body.order : 0,
          }
        : {
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
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2022") || msg.toLowerCase().includes("animation")) {
      // Migration for banner animation not applied yet — retry once without
      // persisting the animation value so creation still succeeds. Every
      // model-level create references the pending column internally, so the
      // transitional insert is parameterized raw SQL over the legacy shape.
      try {
        const id = crypto.randomUUID();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = await db.$queryRaw<Array<Record<string, any>>>`
          INSERT INTO "Banner" ("id", "title", "subtitle", "description", "imageUrl", "videoUrl", "buttonText", "buttonUrl", "startDate", "endDate", "isActive", "displayOrder", "createdAt", "updatedAt")
          VALUES (
            ${id},
            ${String(body.title)},
            ${typeof body.subtitle === "string" ? body.subtitle : null},
            ${typeof body.description === "string" ? body.description : null},
            ${isNonEmpty(body.imageUrl ?? body.image) ? String(body.imageUrl ?? body.image) : null},
            ${typeof body.videoUrl === "string" ? body.videoUrl : null},
            ${typeof body.buttonText === "string" ? body.buttonText : null},
            ${typeof body.buttonUrl === "string" ? body.buttonUrl : null},
            ${parseDate(body.startDate)},
            ${parseDate(body.endDate)},
            ${typeof body.isActive === "boolean" ? body.isActive : body.active === true},
            ${typeof body.displayOrder === "number" ? Math.max(0, Math.round(body.displayOrder)) : typeof body.order === "number" ? Math.max(0, Math.round(body.order)) : 0},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING "id", "title", "subtitle", "description", "imageUrl", "videoUrl", "buttonText", "buttonUrl", "startDate", "endDate", "isActive", "displayOrder", "createdAt", "updatedAt"`;
        const row = rows[0] as (Record<string, unknown> & { id: string }) | undefined;
        if (!row) return serverError("banners:create-fallback", new Error("Created banner could not be read back."));
        const item = {
          id: row.id,
          title: row.title,
          subtitle: (row.subtitle as string | null) ?? null,
          description: (row.description as string | null) ?? null,
          imageUrl: (row.imageUrl as string | null) ?? null,
          videoUrl: (row.videoUrl as string | null) ?? null,
          buttonText: (row.buttonText as string | null) ?? null,
          buttonUrl: (row.buttonUrl as string | null) ?? null,
          startDate: row.startDate ? toIso(row.startDate) : null,
          endDate: row.endDate ? toIso(row.endDate) : null,
          animation: "none",
          isActive: Boolean(row.isActive),
          displayOrder: Number(row.displayOrder ?? 0),
          createdAt: toIso(row.createdAt),
          updatedAt: toIso(row.updatedAt),
        };
        return ok({ item, warning: "Animation style could not be saved yet (migration pending); banner was created without animation." }, 201);
      } catch (err2) {
        return serverError("banners:create", err2);
      }
    }
    return serverError("banners:create", err);
  }
}
