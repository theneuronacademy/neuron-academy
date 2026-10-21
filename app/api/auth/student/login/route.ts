// Phase 10 — student login (mobile + password, server session).
// Identity always derived server-side; never trust client studentId.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { sanitizeUser } from "@/lib/server-auth";
import { createSessionToken, isAuthConfigured, sessionCookieHeader } from "@/lib/session";
import { normalizePhone, verifyPassword } from "@/lib/credentials";
import { missingFields } from "@/lib/validation";
import { studentAuthRateLimits, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
// Vercel: bcrypt verify + DB + cold start headroom (Pro plan).
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = getClientIp(req);
  const rateLimit = studentAuthRateLimits.login(ip);
  if (!rateLimit.allowed) {
    const res = fail(`Too many login attempts. Try again in ${Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)} seconds.`, 429);
    rateLimitResponse(rateLimit).forEach((v, k) => res.headers.set(k, v));
    return res;
  }

  const db = getDb();
  if (!db) return dbNotConfigured("Student login");
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
    const student = await db.student.findFirst({ where: { phone }, include: { user: true } });
    const user = student?.user;
    if (!student || !user || user.role !== "STUDENT") return fail("Invalid mobile number or password.", 401);
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      return fail("Invalid mobile number or password.", 401);
    }
    if (!user.isActive || student.status !== "ACTIVE") return fail("This account is deactivated. Contact the academy office.", 403);
    const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: "STUDENT" });
    if (!token) return fail("Login needs SESSION_SECRET.", 503);
    const res = ok({
      user: sanitizeUser({ id: user.id, name: user.name, email: user.email, role: user.role }),
      student: { id: student.id, studentId: student.studentId, name: student.name, batchId: student.batchId, courseId: student.courseId },
    });
    // Add rate limit headers
    rateLimitResponse(rateLimit).forEach((v, k) => res.headers.set(k, v));
    res.headers.set("Set-Cookie", sessionCookieHeader(token));
    return res;
  } catch (err) {
    return serverError("auth:student-login", err);
  }
}
