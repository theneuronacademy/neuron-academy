// Phase 10 — faculty login (mobile + password, server session).
// Pending-approval accounts get 403; never leaks whether the number exists.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { sanitizeUser } from "@/lib/server-auth";
import { createSessionToken, isAuthConfigured, sessionCookieHeader } from "@/lib/session";
import { normalizePhone, verifyPassword } from "@/lib/credentials";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Faculty login");
  if (!isAuthConfigured()) return fail("Login needs SESSION_SECRET.", 503);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["phone", "password"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  const phone = normalizePhone(body.phone);
  if (!phone || typeof body.password !== "string") return fail("Invalid mobile number or password.", 401);
  try {
    const faculty = await db.faculty.findFirst({ where: { phone }, include: { user: true } });
    const user = faculty?.user;
    if (!faculty || !user || user.role !== "FACULTY") return fail("Invalid mobile number or password.", 401);
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      return fail("Invalid mobile number or password.", 401);
    }
    if (!user.isActive) {
      return fail(
        faculty.status === "INACTIVE" ? "Account pending admin approval." : "This account is deactivated. Contact the academy office.",
        403
      );
    }
    const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: "FACULTY" });
    if (!token) return fail("Login needs SESSION_SECRET.", 503);
    const res = ok({
      user: sanitizeUser({ id: user.id, name: user.name, email: user.email, role: user.role }),
      faculty: { id: faculty.id, facultyId: faculty.facultyId, name: faculty.name, subject: faculty.subject },
    });
    res.headers.set("Set-Cookie", sessionCookieHeader(token));
    return res;
  } catch (err) {
    return serverError("auth:faculty-login", err);
  }
}
