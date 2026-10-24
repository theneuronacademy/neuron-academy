// Editable homepage content.
// GET /api/homepage/content — PUBLIC: list active content items (only
// isActive rows, non-sensitive key/value copy) so the public homepage can
// read admin edits directly.
// POST /api/homepage/content — ADMIN only: create or upsert an item.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Reading homepage content");
  try {
    const items = await db.homepageContent.findMany({
      where: { isActive: true },
      orderBy: { key: "asc" },
    });
    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("homepage:content:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Saving homepage content");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const value = typeof body.value === "string" ? body.value.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "text";
  if (!key) return fail("key is required.", 400);
  if (!value) return fail("value is required.", 400);
  try {
    const item = await db.homepageContent.upsert({
      where: { key },
      update: { value, type },
      create: { key, value, type, isActive: true },
    });
    return ok({ item }, 201);
  } catch (err) {
    return serverError("homepage:content:create", err);
  }
}
