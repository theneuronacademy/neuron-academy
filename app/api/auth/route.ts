// Phase 3 — Auth status endpoint (demo mode).
// The current demo login (lib/adminAuth.ts, localStorage) is UNCHANGED.
// TODO production auth: POST credentials → verify bcrypt hash → httpOnly
// session/JWT; middleware guards /admin/* by role (ADMIN/FACULTY/STUDENT).

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
