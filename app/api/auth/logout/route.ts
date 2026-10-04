// Phase 4 — logout: clear the session cookie. Always succeeds.

import { ok } from "@/lib/api-response";
import { clearSessionCookieHeader } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = ok({ loggedOut: true });
  res.headers.set("Set-Cookie", clearSessionCookieHeader());
  return res;
}
