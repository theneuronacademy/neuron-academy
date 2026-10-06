"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";

/**
 * Phase 10: validates the SERVER session (role ADMIN). Falls back to the
 * local demo flag only when the backend is unreachable (dev, 503).
 * Middleware already enforces this server-side when SESSION_SECRET is set.
 */
export function useAdminGuard(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.data?.user?.role === "ADMIN") {
            setReady(true);
            return;
          }
          router.replace("/admin/login");
          return;
        }
      } catch {
        /* fall through to demo flag (dev only) */
      }
      if (!isAdminAuthenticated()) {
        router.replace("/admin/login");
        return;
      }
      setReady(true);
    })();
  }, [router]);
  return ready;
}
