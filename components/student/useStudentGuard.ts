"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudentSession } from "@/lib/studentAuth";

/**
 * Phase 10: validates the SERVER session (role STUDENT or ADMIN) and loads
 * the real profile from /api/students/me. Falls back to the local demo
 * session only when the backend is unreachable (dev, 503).
 */
export function useStudentGuard() {
  const router = useRouter();
  const [session, setSession] = useState(() => (typeof window !== "undefined" ? getStudentSession() : null));

  useEffect(() => {
    (async () => {
      try {
        const sRes = await fetch("/api/auth/session", { cache: "no-store" });
        if (!sRes.ok) {
          if (!getStudentSession()) router.replace("/student/login");
          return;
        }
        const sJson = await sRes.json().catch(() => null);
        const role = sJson?.data?.user?.role;
        if (role !== "STUDENT" && role !== "ADMIN") {
          router.replace("/student/login");
          return;
        }
        if (role === "ADMIN") return; // admin preview keeps existing session
        const mRes = await fetch("/api/students/me", { cache: "no-store" });
        const mJson = await mRes.json().catch(() => null);
        if (mRes.ok && mJson?.success === true && mJson.data?.item) {
          const item = mJson.data.item;
          setSession({ studentId: item.studentId, name: item.name, loggedInAt: new Date().toISOString() });
          return;
        }
        if (!getStudentSession()) router.replace("/student/login");
      } catch {
        if (!getStudentSession()) router.replace("/student/login");
      }
    })();
  }, [router]);

  return session;
}
