// "About the Academy" media API — ADMIN-managed collection of images,
// independent from the academy gallery (separate table, separate routes).
// GET is public (only active rows for visitors; ADMIN sees everything so the
// manager can toggle/unpublish without losing rows).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { getUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

function isMissingAboutTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : "";
  // P2021: table does not exist (migration pending).
  return msg.includes("P2021") && msg.includes("AboutImage");
}

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) {
    // No database configured — the public About section falls back to its
    // static placeholder, so an empty list is the honest answer.
    return ok({ items: [], source: "fallback" });
  }
  // ADMIN sees all rows (including unpublished); visitors only active ones.
  const viewer = getUserFromRequest(req);
  try {
    const rows = await db.aboutImage.findMany({
      where: viewer?.role === "ADMIN" ? {} : { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      take: 200,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    if (isMissingAboutTable(err)) {
      return ok({
        items: [],
        source: "database",
        warning: "The About media database update has not been applied yet — the section shows the default photo until it is.",
      });
    }
    return serverError("aboutMedia:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Adding an About image");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (imageUrl === "") return fail("Missing required fields: imageUrl.", 400);
  const data = {
    imageUrl,
    publicId: typeof body.publicId === "string" ? body.publicId : undefined,
    caption: typeof body.caption === "string" ? body.caption : undefined,
    altText: typeof body.altText === "string" ? body.altText : undefined,
    displayOrder: typeof body.displayOrder === "number" ? Math.max(0, Math.round(body.displayOrder)) : undefined,
    isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
  };
  try {
    const created = await db.aboutImage.create({ data });
    return ok({ item: created }, 201);
  } catch (err) {
    if (isMissingAboutTable(err)) {
      return fail("The About media database update has not been applied yet — run it before adding images. No data was lost.", 503);
    }
    return serverError("aboutMedia:create", err);
  }
}
