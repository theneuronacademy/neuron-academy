// Phase 13 — Client-side Push Notification Hook
// Handles subscription, permission requests, and service worker registration

"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/lib/studentAuth";

export type PushPermissionState = "default" | "granted" | "denied";

export function usePushNotifications() {
  const { studentId } = useSession();
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  // Check permission state
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  // Fetch VAPID public key
  useEffect(() => {
    let mounted = true;
    fetch("/api/push/subscribe", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success && json.data?.publicKey) {
          setPublicKey(json.data.publicKey);
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => { mounted = false; };
  }, []);

  // Check existing subscription
  const checkSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!publicKey) {
      setError("Push not configured. Contact administrator.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("Push notifications not supported in this browser.");
      return;
    }
    if (Notification.permission === "denied") {
      setError("Notifications are blocked. Enable them in browser settings.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setError("Notification permission denied.");
        setLoading(false);
        return;
      }
      setPermission("granted");

      // Get service worker registration
      const reg = await navigator.serviceWorker.ready;

      // Subscribe
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send to server
      const p256dhKey = sub.getKey("p256dh");
      const authKey = sub.getKey("auth");
      const arrayToBase64 = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      };
      const p256dh = p256dhKey ? arrayToBase64(p256dhKey) : "";
      const auth = authKey ? arrayToBase64(authKey) : "";

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh, auth },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to save subscription");

      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription failed");
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unsubscribe failed");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    permission,
    subscribed,
    loading,
    error,
    publicKey,
    subscribe,
    unsubscribe,
    checkSubscription,
  };
}

// Helper: convert base64url to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}