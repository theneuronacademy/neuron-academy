// Phase 10 — admin login (mobile number + date of birth).
// DOB is verified against a peppered bcrypt hash; generic errors only —
// nothing reveals whether the mobile number exists. DOB never leaves here.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { sanitizeUser } from "@/lib/server-auth";
import { createSessionToken, isAuthConfigured, sessionCookieHeader } from "@/lib/session";
import { normalizeDob, normalizePhone, verifyDob } from "@/lib/credentials";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";
// Vercel: peppered bcrypt verify + DB + cold start headroom (Pro plan).
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Admin login");
  if (!isAuthConfigured()) return fail("Login needs SESSION_SECRET.", 503);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["mobile", "dob"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  const phone = normalizePhone(body.mobile);
  const dob = normalizeDob(body.dob);
  if (!phone || !dob) return fail("Invalid mobile number or date of birth.", 401);
  try {
    const user = await db.user.findFirst({ where: { phone, role: "ADMIN" } });
    if (!user || !user.dobHash) return fail("Invalid mobile number or date of birth.", 401);
    if (!(await verifyDob(dob, user.dobHash))) {
      return fail("Invalid mobile number or date of birth.", 401);
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
    return serverError("auth:admin-login", err);
  }
}
