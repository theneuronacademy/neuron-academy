// Phase 10 — admin login (mobile + password only).
// Password is verified against a bcrypt hash; generic errors only —
// nothing reveals whether the phone exists. Password never leaves here.
// DOB-based login is removed; authentication is phone + password only.

import { NextRequest } from "next/server";
import { fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { sanitizeUser } from "@/lib/server-auth";
import { createSessionToken, isAuthConfigured, sessionCookieHeader } from "@/lib/session";
import { missingFields } from "@/lib/validation";
import { normalizePhone, verifyPassword } from "@/lib/credentials";

export const dynamic = "force-dynamic";
// Vercel: bcrypt verify + DB + cold start headroom (Pro plan).
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return fail("Login needs a database. Set DATABASE_URL to enable real authentication.", 503);
  if (!isAuthConfigured()) return fail("Login needs SESSION_SECRET. Set it to enable real authentication.", 503);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["phone", "password"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  const phone = normalizePhone(body.phone);
  if (!phone) return fail("Invalid mobile number.", 400);
  if (typeof body.password !== "string" || body.password.length < 1) {
    return fail("Invalid mobile or password.", 401);
  }
  try {
    const user = await db.user.findFirst({ where: { phone, role: "ADMIN" } });
    if (!user) return fail("Incorrect mobile or password.", 401);
    if (!(await verifyPassword(String(body.password), user.passwordHash))) {
      return fail("Incorrect mobile or password.", 401);
    }
    if (!user.isActive) return fail("This account is deactivated.", 403);
    const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: "ADMIN" });
    if (!token) return fail("Login needs SESSION_SECRET.", 503);
    const res = ok({
      user: sanitizeUser({ id: user.id, name: user.name, email: user.email, role: user.role }),
    });
    res.headers.set("Set-Cookie", sessionCookieHeader(token));
    return res;
  } catch (err) {
    console.error("[admin-login] error:", err);
    return serverError("auth:admin-login", err);
  }
}
