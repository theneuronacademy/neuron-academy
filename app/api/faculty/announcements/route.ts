// Faculty → own-batch announcements.
// POST /api/faculty/announcements — { batchId, title, message }.
// GET  /api/faculty/announcements — faculty's own sent announcements.
// FACULTY-only. Batch scoping is enforced twice: here (assigned-batch
// check) and inside the engine (faculty can never reach beyond their own
// batches). Students receive via their normal notification feed.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";
import { dispatchNotification } from "@/services/notificationEngine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading sent announcements");
  try {
    const rows = await db.notification.findMany({
      where: { createdById: auth.user.id, audience: "BATCH" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true, message: true, targetBatchId: true, createdAt: true, status: true },
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("faculty:announcements:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Sending announcement");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const batchId = typeof body.batchId === "string" ? body.batchId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!batchId) return fail("batchId is required.", 400);
  if (title.length < 3 || title.length > 120) return fail("Title must be 3–120 characters.", 400);
  if (message.length < 3 || message.length > 1000) return fail("Message must be 3–1000 characters.", 400);
  try {
    const allowed = await facultyBatchIds(db, auth.user.id);
    if (!allowed.includes(batchId)) {
      return fail("Forbidden: batch not assigned to you.", 403);
    }
    const report = await dispatchNotification(db, {
      event: "BATCH_ANNOUNCEMENT",
      actor: { id: auth.user.id, role: "FACULTY" },
      audience: { kind: "BATCH", batchId },
      title,
      message,
      templateKey: "BATCH_ANNOUNCEMENT",
      vars: { batchName: batchId, message },
      createdById: auth.user.id,
      internal: true,
      idempotencyKey: `FACULTY_BATCH:${auth.user.id}:${batchId}:${Date.now()}`,
    });
    return ok({ report }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("NOTIFY_")) return fail("Could not send announcement.", 400);
    return serverError("faculty:announcements:send", err);
  }
}
