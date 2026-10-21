// Student registration. A fresh, single-use MSG91/direct-OTP verification
// is required in every environment before an account can be created.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { sanitizeUser } from "@/lib/server-auth";
import { createSessionToken, isAuthConfigured, sessionCookieHeader } from "@/lib/session";
import { hashPassword, isValidPassword, normalizePhone } from "@/lib/credentials";
import { isEmail, isNonEmpty, missingFields } from "@/lib/validation";
import { OTP_VERIFIED_TTL_MIN } from "@/lib/otp";
import { notifyMessages } from "@/lib/notify";
import { dispatchNotification } from "@/services/notificationEngine";
import { studentAuthRateLimits, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

function studentId(): string {
  return `NA-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function isUniqueConflict(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && err.code === "P2002");
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = studentAuthRateLimits.register(ip);
  if (!rateLimit.allowed) {
    const res = fail(`Too many registration attempts. Try again in ${Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)} seconds.`, 429);
    rateLimitResponse(rateLimit).forEach((value, key) => res.headers.set(key, value));
    return res;
  }

  const db = getDb();
  if (!db) return dbNotConfigured("Student registration");
  if (!isAuthConfigured()) return fail("Registration needs SESSION_SECRET.", 503);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["name", "phone", "email", "password"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  const name = String(body.name).trim();
  if (name.length < 2 || name.length > 80) return fail("Name must be 2–80 characters.", 400);
  const phone = normalizePhone(body.phone);
  if (!phone) return fail("Invalid mobile number.", 400);
  const email = String(body.email).trim().toLowerCase();
  if (!isEmail(email)) return fail("Invalid email.", 400);
  if (!isValidPassword(body.password)) return fail("Password must be 8–128 characters.", 400);

  const now = new Date();
  const verifiedSince = new Date(now.getTime() - OTP_VERIFIED_TTL_MIN * 60 * 1000);
  try {
    const registration = await db.$transaction(async (tx) => {
      const verified = await tx.otpRequest.findFirst({
        where: {
          phone,
          purpose: "REGISTER",
          consumed: false,
          verifiedAt: { gte: verifiedSince },
          expiresAt: { gt: now },
        },
        orderBy: { verifiedAt: "desc" },
      });
      if (!verified) return { error: "OTP" as const };

      if (await tx.student.findFirst({ where: { phone }, select: { id: true } })) {
        return { error: "PHONE" as const };
      }
      if (await tx.user.findFirst({ where: { phone }, select: { id: true } })) {
        return { error: "PHONE" as const };
      }
      if (await tx.student.findUnique({ where: { email }, select: { id: true } }) ||
          await tx.user.findUnique({ where: { email }, select: { id: true } })) {
        return { error: "EMAIL" as const };
      }

      // Claim the proof atomically. If two requests race, only one can
      // consume it; any later write failure rolls the claim back.
      const claimed = await tx.otpRequest.updateMany({
        where: {
          id: verified.id,
          consumed: false,
          verifiedAt: { gte: verifiedSince },
          expiresAt: { gt: now },
        },
        data: { consumed: true },
      });
      if (claimed.count !== 1) return { error: "OTP" as const };

      let sid = studentId();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (!(await tx.student.findUnique({ where: { studentId: sid }, select: { id: true } }))) break;
        sid = studentId();
      }

      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash: await hashPassword(String(body.password)),
          role: "STUDENT",
          isActive: true,
        },
      });
      const student = await tx.student.create({
        data: {
          userId: user.id,
          studentId: sid,
          name,
          email,
          phone,
          courseId: isNonEmpty(body.courseId) ? String(body.courseId) : undefined,
          batchId: isNonEmpty(body.batchId) ? String(body.batchId) : undefined,
          status: "ACTIVE",
        },
      });
      return { user, student };
    });

    if ("error" in registration) {
      if (registration.error === "OTP") return fail("Mobile verification expired. Please verify your number again.", 428, "OTP_VERIFICATION_REQUIRED");
      if (registration.error === "PHONE") return fail("This mobile number is already registered.", 409, "STUDENT_ALREADY_REGISTERED");
      return fail("This email is already registered.", 409, "EMAIL_ALREADY_REGISTERED");
    }

    const { user, student } = registration;
    const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: "STUDENT" });
    if (!token) return fail("Registration needs SESSION_SECRET.", 503);

    // Welcome notification is intentionally outside the auth-critical DB
    // transaction. Notification dispatch is best-effort and never blocks login.
    const msg = notifyMessages.registrationWelcome(name);
    await dispatchNotification(db, {
      event: "REGISTRATION_UPDATE",
      actor: { id: user.id, role: "STUDENT" },
      audience: { kind: "INDIVIDUAL", studentId: student.id },
      title: msg.title,
      message: msg.message,
      templateKey: "REGISTRATION_UPDATE",
      vars: { message: msg.message },
      channels: ["IN_APP"],
      createdById: user.id,
      internal: true,
      idempotencyKey: `REGISTRATION_UPDATE:${student.id}`,
    });

    const res = ok({
      user: sanitizeUser({ id: user.id, name: user.name, email: user.email, role: user.role }),
      student: { id: student.id, studentId: student.studentId, name: student.name },
    }, 201);
    rateLimitResponse(rateLimit).forEach((value, key) => res.headers.set(key, value));
    res.headers.set("Set-Cookie", sessionCookieHeader(token));
    return res;
  } catch (err) {
    if (isUniqueConflict(err)) return fail("An account with these details already exists.", 409, "ACCOUNT_ALREADY_EXISTS");
    return serverError("auth:student-register", err);
  }
}
