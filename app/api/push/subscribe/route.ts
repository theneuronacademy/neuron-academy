// Phase 13 — Web Push subscription storage (foundation only).
// GET:  returns the VAPID public key (safe for browsers) or an honest
//       not-configured error. POST/DELETE store/remove the caller's own
//       subscription — userId always comes from the session, never the client.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { subscribe, unsubscribe, webPushEnv } from "@/services/webPush";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = webPushEnv();
  if (!env) return fail("Web Push is not configured.", 503);
  return ok({ publicKey: env.publicKey });
}

export async function POST(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  const db = getDb();
  if (!db) return dbNotConfigured("Saving a push subscription");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const keys = (body.keys ?? {}) as Record<string, unknown>;
  const res = await subscribe(db, viewer.id, endpoint, {
    p256dh: typeof keys.p256dh === "string" ? keys.p256dh : undefined,
    auth: typeof keys.auth === "string" ? keys.auth : undefined,
  });
  if (!res.ok) return fail(res.error ?? "Could not save the subscription.", 400);
  return ok({ subscribed: true }, 201);
}

export async function DELETE(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  const db = getDb();
  if (!db) return dbNotConfigured("Removing a push subscription");
  let endpoint = "";
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    endpoint = typeof body?.endpoint === "string" ? body.endpoint : new URL(req.url).searchParams.get("endpoint") ?? "";
  } catch {
    endpoint = new URL(req.url).searchParams.get("endpoint") ?? "";
  }
  await unsubscribe(db, viewer.id, endpoint);
  return ok({ unsubscribed: true });
}
