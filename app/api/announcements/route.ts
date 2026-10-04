// Phase 3 — Announcements API. Demo fallback when DATABASE_URL is missing.
// TODO auth: writes need ADMIN role once the session layer lands.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { parseDate } from "@/lib/validation";
import { DEMO_ANNOUNCEMENTS } from "@/data/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  if (!db) return ok({ items: DEMO_ANNOUNCEMENTS, source: "demo" });
  try {
    const rows = await db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return ok({
      items: rows.map((a) => ({ id: a.id, text: `${a.title} — ${a.content}`, active: a.isActive, date: new Date(a.createdAt).toISOString().slice(0, 10) })),
      source: "database",
    });
  } catch (err) {
    return serverError("announcements:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Publishing an announcement");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  // Accept both shapes: { title, content } and legacy { text }.
  const title = typeof body.title === "string" && body.title.trim() ? body.title : typeof body.text === "string" ? body.text : "";
  if (!title.trim()) return fail("Missing required fields: title.", 400);
  try {
    const created = await db.announcement.create({
      data: {
        title: title.trim(),
        content: typeof body.content === "string" ? body.content : title.trim(),
        targetAudience: typeof body.targetAudience === "string" ? body.targetAudience : "ALL",
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("announcements:create", err);
  }
}
