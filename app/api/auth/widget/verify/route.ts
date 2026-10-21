// Verify MSG91's signed access token before authorizing a student action.
// Registration only records a short-lived OTP proof; login only signs in an
// existing active student. This route never creates placeholder accounts.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { sanitizeUser } from "@/lib/server-auth";
import { createSessionToken, isAuthConfigured, sessionCookieHeader } from "@/lib/session";
import { normalizeIndianMobile, OTP_VERIFIED_TTL_MIN } from "@/lib/otp";
import { verifyWidgetToken, WIDGET_TOKEN_INVALID, WIDGET_CONFIGURATION_ERROR } from "@/services/msg91";
import { getClientIp, rateLimitResponse, studentAuthRateLimits } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Widget token verification");
  if (!isAuthConfigured()) return fail("Authentication needs SESSION_SECRET.", 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  const purpose = body.purpose;
  if (!accessToken) return fail("Missing access token.", 400);
  if (purpose !== "LOGIN" && purpose !== "REGISTER") return fail("Choose a valid verification purpose.", 400);

  const rateLimit = purpose === "LOGIN"
    ? studentAuthRateLimits.login(getClientIp(req))
    : studentAuthRateLimits.register(getClientIp(req));
  if (!rateLimit.allowed) {
    const res = fail(`Too many ${purpose === "LOGIN" ? "login" : "registration"} attempts. Please wait before trying again.`, 429);
    rateLimitResponse(rateLimit).forEach((value, key) => res.headers.set(key, value));
    return res;
  }

  const verified = await verifyWidgetToken(accessToken);
  if (!verified.ok) {
    const status = verified.code === WIDGET_CONFIGURATION_ERROR ? 503 : verified.code === WIDGET_TOKEN_INVALID ? 400 : 502;
    return fail(verified.error ?? "Token verification failed.", status, verified.code);
  }

  const phone = normalizeIndianMobile(verified.phone);
  if (!phone) return fail("Invalid mobile number from provider.", 422);

  try {
    const student = await db.student.findFirst({ where: { phone }, include: { user: true } });

    if (purpose === "REGISTER") {
      if (student || await db.user.findFirst({ where: { phone }, select: { id: true } })) {
        return fail("This mobile number is already linked to an account. Please sign in instead.", 409, "STUDENT_ALREADY_REGISTERED");
      }

      const now = new Date();
      const expiry = new Date(now.getTime() + OTP_VERIFIED_TTL_MIN * 60 * 1000);
      // Supersede older registration proofs so the most recent verification
      // is the only one eligible to create an account.
      await db.otpRequest.updateMany({
        where: { phone, purpose: "REGISTER", consumed: false, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
      await db.otpRequest.create({
        data: {
          phone,
          purpose: "REGISTER",
          otpHash: null,
          attempts: 0,
          resendCount: 0,
          expiresAt: expiry,
          verifiedAt: now,
          consumed: false,
          lastSentAt: now,
        },
      });
      const res = ok({ verified: true, purpose, phone, expiresAt: expiry.toISOString() });
      rateLimitResponse(rateLimit).forEach((value, key) => res.headers.set(key, value));
      return res;
    }

    if (!student || !student.user || student.user.role !== "STUDENT") {
      return fail("No student account is linked to this mobile number. Please register first.", 404, "STUDENT_NOT_FOUND");
    }
    if (!student.user.isActive || student.status !== "ACTIVE") {
      return fail("This account is deactivated. Contact the academy office.", 403, "STUDENT_INACTIVE");
    }

    const token = createSessionToken({ id: student.user.id, email: student.user.email, name: student.user.name, role: "STUDENT" });
    if (!token) return fail("Login needs SESSION_SECRET.", 503);
    const res = ok({
      purpose,
      user: sanitizeUser({ id: student.user.id, name: student.user.name, email: student.user.email, role: student.user.role }),
      student: { id: student.id, studentId: student.studentId, name: student.name, batchId: student.batchId, courseId: student.courseId },
    });
    rateLimitResponse(rateLimit).forEach((value, key) => res.headers.set(key, value));
    res.headers.set("Set-Cookie", sessionCookieHeader(token));
    return res;
  } catch (err) {
    return serverError("auth:widget-verify", err);
  }
}
