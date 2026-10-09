// Phase 3 — Courses API. Demo fallback from public catalogue when DB is missing.
// TODO auth: writes need ADMIN role once the session layer lands.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { getUserFromRequest } from "@/lib/session";
import { isNonEmpty, missingFields, toSlug } from "@/lib/validation";
import { COURSES } from "@/data/courses";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) {
    return ok({
      items: COURSES.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.id,
        description: c.desc,
        shortDescription: c.desc,
        image: c.image,
        duration: c.duration,
        fee: null,
        status: c.admissionOpen ? "ACTIVE" : "INACTIVE",
        displayOrder: 0,
      })),
      source: "demo",
    });
  }
  try {
    // Unpublished courses stay invisible publicly; ADMIN sees everything
    // for catalogue management (same pattern as gallery/testimonials).
    const viewer = getUserFromRequest(req);
    const rows = await db.course.findMany({
      where: viewer?.role === "ADMIN" ? {} : { status: "ACTIVE" },
      orderBy: { displayOrder: "asc" },
      take: 200,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("courses:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating a course");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["name"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  try {
    const name = String(body.name);
    const created = await db.course.create({
      data: {
        name,
        slug: isNonEmpty(body.slug) ? String(body.slug) : toSlug(name),
        description: typeof body.description === "string" ? body.description : undefined,
        shortDescription: typeof body.shortDescription === "string" ? body.shortDescription : undefined,
        image: typeof body.image === "string" ? body.image : undefined,
        duration: typeof body.duration === "string" ? body.duration : undefined,
        fee: typeof body.fee === "number" ? body.fee : undefined,
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("courses:create", err);
  }
}
