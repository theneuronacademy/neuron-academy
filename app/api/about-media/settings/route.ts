// "About the Academy" media section settings — layout + animation choice.
// Stored in homepageContent (same key/value store as the About copy) under
// keys "about.media.layout" / "about.media.animation".
// GET is public (display preferences are not sensitive; missing values fall
// back to safe defaults so the public section never breaks).
// PATCH is ADMIN-only.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { toBannerAnimation } from "@/components/website/bannerMotion";

export const dynamic = "force-dynamic";

const LAYOUT_KEY = "about.media.layout";
const ANIMATION_KEY = "about.media.animation";
const LAYOUTS = ["grid", "carousel", "rotate"] as const;
type AboutLayoutSetting = (typeof LAYOUTS)[number];

const ABOUT_DEFAULT_SETTINGS = { layout: "grid" as AboutLayoutSetting, animation: "none" as const };

function isMissingHomepageTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("P2021") && msg.includes("HomepageContent");
}

function parseLayout(v: string | null | undefined): AboutLayoutSetting {
  return (LAYOUTS as readonly string[]).includes(v ?? "") ? (v as AboutLayoutSetting) : ABOUT_DEFAULT_SETTINGS.layout;
}

export async function GET() {
  const db = getDb();
  if (!db) return ok({ ...ABOUT_DEFAULT_SETTINGS, source: "defaults" });
  try {
    const rows = await db.homepageContent.findMany({
      where: { key: { in: [LAYOUT_KEY, ANIMATION_KEY] }, isActive: true },
    });
    const values = new Map(rows.map((r) => [r.key, r.value]));
    return ok({
      layout: parseLayout(values.get(LAYOUT_KEY)),
      animation: toBannerAnimation(values.get(ANIMATION_KEY)),
      source: rows.length > 0 ? "database" : "defaults",
    });
  } catch (err) {
    if (isMissingHomepageTable(err)) return ok({ ...ABOUT_DEFAULT_SETTINGS, source: "defaults" });
    return serverError("aboutMedia:settings", err);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Saving About media settings");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  if (body.layout !== undefined && !(LAYOUTS as readonly string[]).includes(String(body.layout))) {
    return fail("layout must be \"grid\", \"carousel\", or \"rotate\".", 400);
  }
  const layout = body.layout !== undefined ? parseLayout(String(body.layout)) : undefined;
  const animation = body.animation !== undefined ? toBannerAnimation(body.animation) : undefined;
  if (layout === undefined && animation === undefined) return fail("No changes provided.", 400);
  try {
    if (layout !== undefined) {
      await db.homepageContent.upsert({
        where: { key: LAYOUT_KEY },
        update: { value: layout },
        create: { key: LAYOUT_KEY, value: layout, type: "text", isActive: true },
      });
    }
    if (animation !== undefined) {
      await db.homepageContent.upsert({
        where: { key: ANIMATION_KEY },
        update: { value: animation },
        create: { key: ANIMATION_KEY, value: animation, type: "text", isActive: true },
      });
    }
    return ok({ layout: layout ?? undefined, animation: animation ?? undefined, saved: true });
  } catch (err) {
    if (isMissingHomepageTable(err)) {
      return fail("The database update has not been applied yet — About media settings need the homepageContent table.", 503);
    }
    return serverError("aboutMedia:settings:update", err);
  }
}
