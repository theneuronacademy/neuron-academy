// Phase 3 — Enquiries API. Website contact form posts here when DB is live.
// Demo fallback when DATABASE_URL is missing.
// Status changes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { isEmail, isNonEmpty, isPhone, missingFields } from "@/lib/validation";
import { DEMO_ENQUIRIES } from "@/data/admin";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "CONTACTED", "CONVERTED", "CLOSED"] as const;

// Public lead-capture throttle (best-effort, per instance): at most 5
// submissions per IP per 10 minutes. Serverless instances each keep their own
// window, so this is abuse friction — not a security boundary. Never blocks
// legitimate use: legitimate visitors submit once.
const ENQUIRY_WINDOW_MS = 10 * 60 * 1000;
const ENQUIRY_MAX_PER_WINDOW = 5;
const enquiryHits = new Map<string, number[]>();

function enquiryRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (enquiryHits.get(ip) ?? []).filter((t) => now - t < ENQUIRY_WINDOW_MS);
  if (recent.length >= ENQUIRY_MAX_PER_WINDOW) {
    enquiryHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  // Bound memory: drop the entry map's oldest IPs when it grows large.
  if (enquiryHits.size > 2000) {
    const oldest = [...enquiryHits.keys()].slice(0, 500);
    for (const k of oldest) enquiryHits.delete(k);
  }
  enquiryHits.set(ip, recent);
  return false;
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded ? forwarded.split(",")[0].trim() : "";
  return first || req.headers.get("x-real-ip") || "unknown";
}

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
  // Public lead capture (website contact form).
  const db = getDb();
  if (!db) return dbNotConfigured("Saving an enquiry");
  if (enquiryRateLimited(clientIp(req))) {
    return fail("Too many enquiries from this network. Please try again in a few minutes.", 429, "ENQUIRY_RATE_LIMITED");
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 20) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 120) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  const missing = missingFields({ name, phone }, ["name", "phone"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  if (name.length < 2) return fail("Please enter your name.", 400);
  if (!isPhone(phone)) return fail("Invalid phone.", 400);
  if (email && !isEmail(email)) return fail("Invalid email.", 400);
  try {
    const created = await db.enquiry.create({
      data: {
        name,
        phone,
        email: isNonEmpty(email) ? email : undefined,
        courseId: isNonEmpty(body.courseId) ? String(body.courseId) : undefined,
        message: message ? message : undefined,
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
