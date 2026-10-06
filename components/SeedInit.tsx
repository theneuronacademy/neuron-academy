"use client";

import { useEffect } from "react";
import { ensureSeeded } from "@/lib/seed";

/** Mount once per app to seed demo questions/tests/notifications (idempotent).
 * Development only — production never fabricates records. */
export function SeedInit() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    ensureSeeded();
  }, []);
  return null;
}
