// Phase 3 — Health endpoint: build-safe DB connectivity probe.
// Used by ops + future admin "Website status" wiring. Never throws.

import { ok } from "@/lib/api-response";
import { getDb, isDbConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) {
    return ok({ database: "not-configured", mode: "demo", website: "online" });
  }
  try {
    const db = getDb();
    if (!db) {
      return ok({ database: "not-configured", mode: "demo", website: "online" });
    }
    await db.$queryRaw`SELECT 1`;
    return ok({ database: "connected", mode: "database", website: "online" });
  } catch {
    return ok({ database: "unreachable", mode: "demo", website: "online" });
  }
}
