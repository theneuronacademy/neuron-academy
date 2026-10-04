"use client";

import { useEffect } from "react";
import { ensureSeeded } from "@/lib/seed";

/** Mount once per app to seed demo questions/tests/notifications (idempotent). */
export function SeedInit() {
  useEffect(() => {
    ensureSeeded();
  }, []);
  return null;
}
