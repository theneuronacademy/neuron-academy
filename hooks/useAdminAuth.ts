"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useAdminAuth(): { ready: boolean; isAdmin: boolean } {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) {
          if (mounted) router.replace("/admin/login");
          return;
        }
        const json = await res.json();
        const u = json?.data?.user;
        if (!u || u.role !== "ADMIN") {
          if (mounted) router.replace("/admin/login");
          return;
        }
        if (mounted) {
          setIsAdmin(true);
          setReady(true);
        }
      } catch {
        if (mounted) router.replace("/admin/login");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  return { ready, isAdmin };
}