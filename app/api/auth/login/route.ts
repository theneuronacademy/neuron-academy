// Phase 4 — login: email + password → bcrypt → isActive → signed session cookie.
// Never returns passwordHash. 503 when DB/auth is unconfigured (demo fallback stays).

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { sanitizeUser } from "@/lib/server-auth";
import { createSessionToken, isAuthConfigured, sessionCookieHeader } from "@/lib/session";
import { isEmail, missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

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
  const missing = missingFields(body, ["email", "password"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  const email = String(body.email).trim().toLowerCase();
  if (!isEmail(email)) return fail("Invalid email.", 400);
  try {
    const user = await db.user.findUnique({ where: { email } });
    // Same message for unknown email — never reveal which emails exist.
    if (!user) return fail("Incorrect email or password.", 401);
    const match = await bcrypt.compare(String(body.password), user.passwordHash);
    if (!match) return fail("Incorrect email or password.", 401);
    if (!user.isActive) return fail("This account is deactivated. Contact the academy office.", 403);
    const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    if (!token) return fail("Login needs SESSION_SECRET. Set it to enable real authentication.", 503);
    const res = ok({ user: sanitizeUser({ id: user.id, name: user.name, email: user.email, role: user.role }) });
    res.headers.set("Set-Cookie", sessionCookieHeader(token));
    return res;
  } catch (err) {
    return serverError("auth:login", err);
  }
}
