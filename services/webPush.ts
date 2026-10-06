// Phase 13 — Web Push service abstraction (SERVER-ONLY foundation).
// - Subscription storage (subscribe/unsubscribe) works today via Prisma.
// - DELIVERY is intentionally not implemented in this phase: there is no
//   push provider dependency installed. sendNotification always returns an
//   honest WEB_PUSH_NOT_CONFIGURED / WEB_PUSH_PROVIDER_MISSING error and
//   NEVER claims delivery.
// - Required env (see .env.example): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//   VAPID_SUBJECT. The public key is safe to expose to browsers; the
//   private key never leaves the server.

import type { PrismaClient } from "@prisma/client";

type Db = PrismaClient;

export interface PushKeys {
  p256dh?: string;
  auth?: string;
}

export function webPushEnv(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

/** True when VAPID credentials are present (delivery still needs a provider). */
export function isWebPushConfigured(): boolean {
  return webPushEnv() !== null;
}

/** Store (or refresh) a browser push subscription for a user. */
export async function subscribe(
  db: Db,
  userId: string,
  endpoint: string,
  keys: PushKeys
): Promise<{ ok: boolean; error?: string }> {
  if (!endpoint || endpoint.length > 2000) return { ok: false, error: "Invalid subscription endpoint." };
  try {
    await db.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh: keys.p256dh?.slice(0, 500), auth: keys.auth?.slice(0, 500) },
      update: { userId, p256dh: keys.p256dh?.slice(0, 500), auth: keys.auth?.slice(0, 500) },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save the subscription." };
  }
}

/** Remove a browser push subscription. */
export async function unsubscribe(db: Db, userId: string, endpoint: string): Promise<{ ok: boolean }> {
  try {
    await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export interface PushSendResult {
  ok: boolean;
  code: string;
  error?: string;
}

/**
 * Delivery foundation — honest stub. Returns a configuration error until a
 * real provider (e.g. the `web-push` package + VAPID signing) is installed
 * and a browser subscription round-trip has been tested end-to-end.
 */
export async function sendNotification(
  db: Db,
  userId: string,
  payload: { title: string; message: string; url?: string }
): Promise<PushSendResult> {
  void db;
  void userId;
  void payload;
  if (!isWebPushConfigured()) {
    return { ok: false, code: "WEB_PUSH_NOT_CONFIGURED", error: "Web Push is not configured. Set VAPID keys to enable it." };
  }
  return {
    ok: false,
    code: "WEB_PUSH_PROVIDER_MISSING",
    error: "Web Push delivery provider is not installed yet. Subscriptions are stored; delivery lands in a later phase.",
  };
}
