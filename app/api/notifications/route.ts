// Phase 3 — Notifications API. No push provider yet (later phase).
// Demo fallback when DATABASE_URL is missing.
// TODO auth: writes need ADMIN role once the session layer lands.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { missingFields, parseDate } from "@/lib/validation";
import { DEMO_NOTIFICATIONS } from "@/data/admin";

export const dynamic = "force-dynamic";

const AUDIENCES = ["ALL_STUDENTS", "BATCH", "FACULTY", "INDIVIDUAL"] as const;

function audienceLabel(a: string): string {
  if (a === "ALL_STUDENTS") return "All students";
  if (a === "BATCH") return "Batch";
  if (a === "FACULTY") return "Faculty";
  return "Individual";
}

export async function GET(req: NextRequest) {
  // Broadcast history — ADMIN only (scoped per-user feeds land in Phase 5).
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return ok({ items: DEMO_NOTIFICATIONS, source: "demo" });
  try {
    const rows = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return ok({
      items: rows.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        audience: audienceLabel(n.audience),
        date: new Date(n.createdAt).toISOString().slice(0, 10),
        status: n.status === "SENT" ? "Sent" : n.status === "SCHEDULED" ? "Scheduled" : "Draft",
      })),
      source: "database",
    });
  } catch (err) {
    return serverError("notifications:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Sending a notification");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["title", "message"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  try {
    const sendNow = body.sendNow !== false && !body.scheduledAt;
    const created = await db.notification.create({
      data: {
        title: String(body.title),
        message: String(body.message),
        type: typeof body.type === "string" ? body.type : "general",
        audience: AUDIENCES.includes(body.audience as (typeof AUDIENCES)[number]) ? (body.audience as (typeof AUDIENCES)[number]) : "ALL_STUDENTS",
        scheduledAt: parseDate(body.scheduledAt),
        sentAt: sendNow ? new Date() : undefined,
        status: sendNow ? "SENT" : "SCHEDULED",
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("notifications:create", err);
  }
}
