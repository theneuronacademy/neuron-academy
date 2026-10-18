// Phase 13 — Web Push service abstraction (SERVER-ONLY foundation).
// - Subscription storage (subscribe/unsubscribe) works today via Prisma.
// - DELIVERY implemented using web-push package with VAPID signing.
// - Required env (see .env.example): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//   VAPID_SUBJECT. The public key is safe to expose to browsers; the
//   private key never leaves the server.

import type { PrismaClient } from "@prisma/client";
import webpush from "web-push";

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

/** True when VAPID credentials are present. */
export function isWebPushConfigured(): boolean {
  return webPushEnv() !== null;
}

// Legacy constant for backwards compatibility with tests
export const WEB_PUSH_PROVIDER_MISSING = "WEB_PUSH_PROVIDER_MISSING";

/** Initialize web-push with VAPID credentials. */
function initWebPush(): boolean {
  const env = webPushEnv();
  if (!env) return false;
  webpush.setVapidDetails(env.subject, env.publicKey, env.privateKey);
  return true;
}

/** Store (or refresh) a browser push subscription for a user. */
export async function subscribe(
  db: PrismaClient,
  userId: string,
  endpoint: string,
  keys: { p256dh?: string; auth?: string }
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
export async function unsubscribe(db: PrismaClient, userId: string, endpoint: string): Promise<{ ok: boolean }> {
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
 * Send a push notification to all subscriptions for a user.
 * Returns aggregated result.
 */
export async function sendNotification(
  db: PrismaClient,
  userId: string,
  payload: { title: string; message: string; url?: string }
): Promise<PushSendResult> {
  if (!initWebPush()) {
    return { ok: false, code: "WEB_PUSH_NOT_CONFIGURED", error: "Web Push is not configured. Set VAPID keys to enable it." };
  }

  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
      select: { endpoint: true, p256dh: true, auth: true },
    });

    if (subscriptions.length === 0) {
      return { ok: false, code: "NO_SUBSCRIPTIONS", error: "No push subscriptions for user." };
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.message,
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      data: { url: payload.url ?? "/student/notifications" },
      requireInteraction: true,
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh ?? "",
              auth: sub.auth ?? "",
            },
          },
          pushPayload
        );
        sent++;
      } catch (err) {
        failed++;
        // If subscription is expired/invalid (410/404), delete it
        if (err instanceof Error && (err as { statusCode?: number }).statusCode === 410) {
          await db.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } }).catch(() => undefined);
        }
        // Log error but continue with other subscriptions
        console.error(`[webpush] Failed to send to ${sub.endpoint.slice(0, 50)}...:`, err instanceof Error ? err.message : err);
      }
    }

    if (sent > 0) {
      return { ok: true, code: "SENT", error: failed > 0 ? `${failed} subscriptions failed` : undefined };
    }
    return { ok: false, code: "ALL_FAILED", error: "All push deliveries failed." };
  } catch (err) {
    console.error("[webpush] Unexpected error:", err);
    return { ok: false, code: "WEB_PUSH_ERROR", error: "Unexpected error during push delivery." };
  }
}
