// Phase 3 — Popups API. Demo fallback when DATABASE_URL is missing.
// TODO auth: writes need ADMIN role once the session layer lands.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { missingFields, parseDate } from "@/lib/validation";
import { DEMO_POPUPS } from "@/data/admin";

export const dynamic = "force-dynamic";

const FREQUENCIES = ["ONCE_PER_SESSION", "ONCE_PER_DAY", "EVERY_VISIT"] as const;

export async function GET() {
  const db = getDb();
  if (!db) return ok({ items: DEMO_POPUPS, source: "demo" });
  try {
    const rows = await db.popup.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("popups:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating a popup");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["title", "message"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  try {
    const created = await db.popup.create({
      data: {
        title: String(body.title),
        message: String(body.message),
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
        videoUrl: typeof body.videoUrl === "string" ? body.videoUrl : undefined,
        buttonText: typeof body.buttonText === "string" ? body.buttonText : undefined,
        buttonUrl: typeof body.buttonUrl === "string" ? body.buttonUrl : undefined,
        frequency: FREQUENCIES.includes(body.frequency as (typeof FREQUENCIES)[number])
          ? (body.frequency as (typeof FREQUENCIES)[number])
          : "ONCE_PER_SESSION",
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("popups:create", err);
  }
}
