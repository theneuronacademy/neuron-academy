// Phase 3 — Testimonials API. Demo fallback when DATABASE_URL is missing.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { getUserFromRequest } from "@/lib/session";
import { missingFields } from "@/lib/validation";
import { TESTIMONIALS } from "@/data/testimonials";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) {
    return ok({
      items: TESTIMONIALS.map((t, i) => ({ id: t.id, name: t.studentName, role: "Student", message: t.testimonial, photo: t.photo || null, rating: 5, isActive: true, displayOrder: i })),
      source: "demo",
    });
  }
  // Phase 17 — ADMIN sees all testimonials; others only active ones.
  const viewer = getUserFromRequest(req);
  try {
    const rows = await db.testimonial.findMany({
      where: viewer?.role === "ADMIN" ? {} : { isActive: true },
      orderBy: { displayOrder: "asc" },
      take: 200,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("testimonials:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Adding a testimonial");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["name", "message"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  if (typeof body.achievement === "string" && body.achievement.trim().length > 80) {
    return fail("Achievement is too long (max 80 characters).", 400);
  }
  try {
    const created = await db.testimonial.create({
      data: {
        name: String(body.name),
        role: typeof body.role === "string" ? body.role : "Student",
        message: String(body.message),
        achievement: typeof body.achievement === "string" && body.achievement.trim() !== "" ? body.achievement.trim() : undefined,
        photo: typeof body.photo === "string" ? body.photo : undefined,
        rating: typeof body.rating === "number" ? Math.min(5, Math.max(1, body.rating)) : 5,
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("testimonials:create", err);
  }
}
