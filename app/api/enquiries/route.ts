// Phase 3 — Enquiries API. Website contact form posts here when DB is live.
// Demo fallback when DATABASE_URL is missing.
// TODO auth: status changes need ADMIN role once the session layer lands.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { isEmail, isNonEmpty, isPhone, missingFields } from "@/lib/validation";
import { DEMO_ENQUIRIES } from "@/data/admin";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "CONTACTED", "CONVERTED", "CLOSED"] as const;

function label(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export async function GET(req: NextRequest) {
  // Lead list contains PII — ADMIN only. Public form uses POST below.
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return ok({ items: DEMO_ENQUIRIES, source: "demo" });
  try {
    const rows = await db.enquiry.findMany({ include: { course: true }, orderBy: { createdAt: "desc" }, take: 500 });
    return ok({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: rows.map((e: any) => ({
        id: e.id,
        name: e.name,
        phone: e.phone,
        email: e.email ?? "",
        course: e.course?.name ?? "—",
        message: e.message ?? "",
        date: new Date(e.createdAt).toISOString().slice(0, 10),
        status: label(e.status),
      })),
      source: "database",
    });
  } catch (err) {
    return serverError("enquiries:list", err);
  }
}

export async function POST(req: NextRequest) {
  // Public lead capture (website contact form). Rate limiting lands in Phase 5.
  const db = getDb();
  if (!db) return dbNotConfigured("Saving an enquiry");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["name", "phone"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  if (!isPhone(body.phone)) return fail("Invalid phone.", 400);
  if (body.email !== undefined && body.email !== "" && !isEmail(body.email)) return fail("Invalid email.", 400);
  try {
    const created = await db.enquiry.create({
      data: {
        name: String(body.name),
        phone: String(body.phone),
        email: isNonEmpty(body.email) ? String(body.email) : undefined,
        courseId: isNonEmpty(body.courseId) ? String(body.courseId) : undefined,
        message: typeof body.message === "string" ? body.message : undefined,
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("enquiries:create", err);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating an enquiry");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  if (!isNonEmpty(body.id)) return fail("Missing enquiry id.", 400);
  if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) return fail("Invalid status.", 400);
  try {
    const row = await db.enquiry.update({ where: { id: String(body.id) }, data: { status: body.status as (typeof STATUSES)[number] } });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Enquiry not found.", 404);
    return serverError("enquiries:update", err);
  }
}
