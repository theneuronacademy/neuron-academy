// Phase 4 — session: who am I? 401 when no valid session.

import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { getUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return fail("Not authenticated.", 401);
  return ok({ user });
}
