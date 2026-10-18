// Phase 13 — Test push notification (admin/dev only)
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { sendNotification } from "@/services/webPush";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "ADMIN") return fail("Admin only.", 403);

  const db = getDb();
  if (!db) return dbNotConfigured("Sending test push");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const targetUserId = typeof body.userId === "string" ? body.userId : viewer.id;
  const title = typeof body.title === "string" ? body.title : "Test Notification";
  const message = typeof body.message === "string" ? body.message : "This is a test push notification from Neuron Academy.";
  const url = typeof body.url === "string" ? body.url : "/student/notifications";

  const res = await sendNotification(db, targetUserId, { title, message, url });
  if (!res.ok) return fail(res.error ?? "Push failed", 500, res.code);
  return ok(res);
}