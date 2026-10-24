// Gallery API — academy media (images AND videos), ADMIN-managed.
// Demo fallback from public gallery data when DB is missing.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { getUserFromRequest } from "@/lib/session";
import { missingFields } from "@/lib/validation";
import { toBannerAnimation } from "@/components/website/bannerMotion";
import { GALLERY } from "@/data/gallery";

export const dynamic = "force-dynamic";

// Columns introduced by the additive academy-media migration. When the
// migration has not been applied yet, Prisma raises P2022 (unknown column);
// the routes below retry without these fields so existing content keeps
// working until the database update lands.
const MEDIA_FIELDS = ["mediaType", "videoUrl", "publicId", "videoPublicId", "caption", "altText", "animation"] as const;

function isMissingMediaColumns(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("P2022") && MEDIA_FIELDS.some((f) => msg.includes(f));
}

/** Resolve mediaType strictly: undefined (absent) or a valid value. */
function parseMediaType(v: unknown): "image" | "video" | undefined | "invalid" {
  if (v === undefined) return undefined;
  if (v === "image" || v === "video") return v;
  return "invalid";
}

/** Normalize raw driver timestamp values into ISO strings. */
function toIso(v: unknown): string {
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) {
    return ok({
      items: GALLERY.map((g, i) => ({
        id: g.id,
        title: g.title,
        description: null,
        imageUrl: g.image,
        category: g.category,
        mediaType: g.mediaType ?? "image",
        videoUrl: g.videoUrl ?? null,
        caption: g.caption ?? null,
        altText: g.altText ?? null,
        animation: g.animation ?? "none",
        displayOrder: i,
        isActive: true,
      })),
      source: "demo",
    });
  }
  // ADMIN sees all gallery items; others only active ones.
  const viewer = getUserFromRequest(req);
  try {
    const rows = await db.galleryItem.findMany({
      where: viewer?.role === "ADMIN" ? {} : { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      take: 200,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    if (isMissingMediaColumns(err)) {
      // Migration pending — fall back to the legacy columns only.
      try {
        const rows = await db.galleryItem.findMany({
          where: viewer?.role === "ADMIN" ? {} : { isActive: true },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          take: 200,
          select: { id: true, title: true, description: true, imageUrl: true, category: true, displayOrder: true, isActive: true, createdAt: true, updatedAt: true },
        });
        const items = rows.map((r: Record<string, unknown>) => ({
          ...r,
          mediaType: "image",
          videoUrl: null,
          publicId: null,
          videoPublicId: null,
          caption: null,
          altText: null,
          animation: "none",
        }));
        return ok({ items, source: "database", warning: "Media fields pending a database update; showing legacy gallery items." });
      } catch (err2) {
        return serverError("gallery:list", err2);
      }
    }
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
  const mediaType = parseMediaType(body.mediaType);
  if (mediaType === "invalid") return fail("mediaType must be \"image\" or \"video\".", 400);
  const resolvedType = mediaType ?? "image";
  const missing = missingFields(body, resolvedType === "video" ? ["title", "videoUrl"] : ["title", "imageUrl"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);

  const mediaTypeIsVideo = resolvedType === "video";
  const data = {
    title: String(body.title),
    description: typeof body.description === "string" ? body.description : undefined,
    // Video-only rows may omit the image asset (imageUrl is nullable).
    imageUrl: typeof body.imageUrl === "string" && body.imageUrl.trim() !== "" ? body.imageUrl.trim() : undefined,
    videoUrl: mediaTypeIsVideo && typeof body.videoUrl === "string" ? body.videoUrl : undefined,
    publicId: typeof body.publicId === "string" ? body.publicId : undefined,
    videoPublicId: mediaTypeIsVideo && typeof body.videoPublicId === "string" ? body.videoPublicId : undefined,
    caption: typeof body.caption === "string" ? body.caption : undefined,
    altText: typeof body.altText === "string" ? body.altText : undefined,
    mediaType: resolvedType,
    category: typeof body.category === "string" ? body.category : "Academy",
    displayOrder: typeof body.displayOrder === "number" ? Math.max(0, Math.round(body.displayOrder)) : undefined,
    isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    animation: toBannerAnimation(body.animation),
  };

  try {
    const created = await db.galleryItem.create({ data });
    return ok({ item: created }, 201);
  } catch (err) {
    if (isMissingMediaColumns(err)) {
      if (mediaTypeIsVideo) {
        return fail("The academy-media database update has not been applied yet — video items cannot be saved until it is. No data was lost.", 503);
      }
      // Legacy shape: only the pre-media columns. Every model-level create
      // (create/createMany) references the pending columns internally, so the
      // transitional insert is parameterized raw SQL over the legacy shape.
      try {
        const id = crypto.randomUUID();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = await db.$queryRaw<Array<Record<string, any>>>`
          INSERT INTO "GalleryItem" ("id", "title", "description", "imageUrl", "category", "displayOrder", "isActive", "createdAt", "updatedAt")
          VALUES (
            ${id},
            ${data.title},
            ${data.description ?? null},
            ${data.imageUrl ?? null},
            ${data.category ?? "Academy"},
            ${data.displayOrder ?? 0},
            ${data.isActive ?? true},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING "id", "title", "description", "imageUrl", "category", "displayOrder", "isActive", "createdAt", "updatedAt"`;
        const row = rows[0] as (Record<string, unknown> & { id: string }) | undefined;
        if (!row) return serverError("gallery:create-fallback", new Error("Created row could not be read back."));
        // RAW driver rows carry no Date objects — normalize each column.
        const item = {
          id: row.id,
          title: row.title,
          description: (row.description as string | null) ?? null,
          imageUrl: (row.imageUrl as string | null) ?? null,
          category: row.category,
          mediaType: "image",
          videoUrl: null,
          publicId: null,
          videoPublicId: null,
          caption: null,
          altText: null,
          animation: "none",
          displayOrder: Number(row.displayOrder ?? 0),
          isActive: Boolean(row.isActive),
          createdAt: toIso(row.createdAt),
          updatedAt: toIso(row.updatedAt),
        };
        return ok({ item, warning: "Saved without the new media fields — the academy-media database update has not been applied yet." }, 201);
      } catch (err2) {
        return serverError("gallery:create", err2);
      }
    }
    return serverError("gallery:create", err);
  }
}
