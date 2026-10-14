// Auth status endpoint.
// Production auth lives in app/api/auth/*/login|register + lib/session.ts
// (HMAC cookie) + lib/server-auth.ts, guarded by edge middleware.

import { ok } from "@/lib/api-response";
import { isDbConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({
    mode: "demo",
    database: isDbConfigured() ? "configured" : "not-configured",
    message: "Authentication is demo-only in this phase. Production sessions land later.",
    supportedRoles: ["ADMIN", "FACULTY", "STUDENT"],
  });
}
