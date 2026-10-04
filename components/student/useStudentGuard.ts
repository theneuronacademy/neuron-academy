"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudentSession, isStudentAuthenticated } from "@/lib/studentAuth";

/** Redirects to /student/login when not authenticated. Returns session. */
export function useStudentGuard() {
  const router = useRouter();
  const [session, setSession] = useState(() => (typeof window !== "undefined" ? getStudentSession() : null));
  useEffect(() => {
    if (!isStudentAuthenticated()) {
      router.replace("/student/login");
      return;
    }
    setSession(getStudentSession());
  }, [router]);
  return session;
}
