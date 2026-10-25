// Dedicated homepage hero image — ADMIN-managed, independent from banner
// records. Stored in the generic HomepageContent key/value mechanism (no
// dedicated table or migration needed):
//   hero.image          — artwork URL (type "url")
//   hero.image.alt      — optional alt text (type "text")
//   hero.image.publicId — media-storage public id for cleanup (type "text")
// GET /api/homepage/hero-image — PUBLIC: current active image (or null).
// POST /api/homepage/hero-image — ADMIN: upload/replace (upserts the keys,
//   reactivating them, freeing the replaced asset best-effort).
// DELETE /api/homepage/hero-image — ADMIN: remove (deactivates; frees the
//   stored asset best-effort).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { cleanupMediaAssets } from "@/lib/media-cleanup";

// Keep these in sync with the client (services/siteApi.ts getLiveHeroImage).
const KEY_URL = "hero.image";
const KEY_ALT = "hero.image.alt";
const KEY_PUBLIC_ID = "hero.image.publicId";

export const dynamic = "force-dynamic";

interface HeroContent {
  imageUrl: string;
  altText: string;
  publicId: string;
}

async function readHeroContent(db: NonNullable<ReturnType<typeof getDb>>): Promise<HeroContent | null> {
  const rows = await db.homepageContent.findMany({
    where: { key: { in: [KEY_URL, KEY_ALT, KEY_PUBLIC_ID] }, isActive: true },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const imageUrl = (map.get(KEY_URL) ?? "").trim();
  if (!imageUrl) return null;
  return {
    imageUrl,
    altText: (map.get(KEY_ALT) ?? "").trim(),
    publicId: (map.get(KEY_PUBLIC_ID) ?? "").trim(),
  };
}

export async function GET() {
  const db = getDb();
  if (!db) {
    // No database configured — the public hero card falls back to its
    // default campus photo, so "no image" is the honest answer.
    return ok({ item: null, source: "fallback" });
  }
  try {
    const item = await readHeroContent(db);
    return ok({ item, source: "database" });
  } catch (err) {
    return serverError("homepage:heroImage:list", err);
  }
}

function upsert(db: NonNullable<ReturnType<typeof getDb>>, key: string, value: string, type: string, isActive: boolean) {
  return db.homepageContent.upsert({
    where: { key },
    update: { value, type, isActive },
    create: { key, value, type, isActive },
  });
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Saving the homepage hero image");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";
  const altText = typeof body.altText === "string" ? body.altText.trim() : "";
  if (imageUrl === "") return fail("imageUrl is required.", 400);
  try {
    // Replace semantics: free the previous asset best-effort once the new
    // image is at hand. Failures never roll the save back (warning only).
    const previous = await readHeroContent(db);
    await Promise.all([
      upsert(db, KEY_URL, imageUrl, "url", true),
      upsert(db, KEY_ALT, altText || "-", "text", altText !== ""),
      upsert(db, KEY_PUBLIC_ID, publicId || "-", "text", publicId !== ""),
    ]);
    const warnings: string[] = [];
    if (previous && previous.publicId && previous.publicId !== publicId) {
      const warning = await cleanupMediaAssets(db, [{ publicId: previous.publicId, resourceType: "image" }]);
      if (warning) warnings.push(warning);
    }
    const item = await readHeroContent(db);
    return ok({ item, ...(warnings.length > 0 ? { warning: warnings[0] } : {}) }, 201);
  } catch (err) {
    return serverError("homepage:heroImage:save", err);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Removing the homepage hero image");
  try {
    const previous = await readHeroContent(db);
    await Promise.all([
      upsert(db, KEY_URL, "-", "url", false),
      upsert(db, KEY_ALT, "-", "text", false),
      upsert(db, KEY_PUBLIC_ID, "-", "text", false),
    ]);
    let warning: string | null = null;
    if (previous?.publicId) {
      warning = await cleanupMediaAssets(db, [{ publicId: previous.publicId, resourceType: "image" }]);
    }
    return warning ? ok({ removed: true, warning }) : ok({ removed: true });
  } catch (err) {
    return serverError("homepage:heroImage:remove", err);
  }
}
