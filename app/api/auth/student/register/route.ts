// Phase 10 — student registration (genuine, server-validated).
// Creates User(STUDENT, active) + Student profile, then signs in.
// Mobile + email unique (checked in code). Password bcrypt-hashed.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { sanitizeUser } from "@/lib/server-auth";
import { createSessionToken, isAuthConfigured, sessionCookieHeader } from "@/lib/session";
import { hashPassword, isValidPassword, normalizePhone } from "@/lib/credentials";
import { isEmail, isNonEmpty, missingFields } from "@/lib/validation";
import { OTP_VERIFIED_TTL_MIN } from "@/lib/otp";
import { isMsg91Configured } from "@/services/msg91";

export const dynamic = "force-dynamic";

function studentId(): string {
  return `NA-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export async function POST(req: NextRequest) {
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
  // Phase 13 — production OTP gate. When MSG91 is configured, registration
  // requires a freshly verified mobile OTP (single-use, consumed below).
  // Without MSG91 credentials the legacy flow stays (dev/demo parity).
  let verifiedOtpId: string | null = null;
  if (isMsg91Configured()) {
    const since = new Date(Date.now() - OTP_VERIFIED_TTL_MIN * 60 * 1000);
    const verified = await db.otpRequest.findFirst({
      where: { phone, consumed: false, verifiedAt: { gte: since }, expiresAt: { gt: new Date() } },
      orderBy: { verifiedAt: "desc" },
    }).catch(() => null);
    if (!verified) {
      return fail("Verify your mobile number with the OTP sent to it before registering.", 428);
    }
    verifiedOtpId = verified.id;
  }
  try {
    if (await db.student.findFirst({ where: { phone }, select: { id: true } })) {
      return fail("This mobile number is already registered.", 409);
    }
    if (await db.student.findUnique({ where: { email }, select: { id: true } })) {
      return fail("This email is already registered.", 409);
    }
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      return fail("This email is already registered.", 409);
    }
    let sid = studentId();
    for (let i = 0; i < 5; i++) {
      if (!(await db.student.findUnique({ where: { studentId: sid }, select: { id: true } }))) break;
      sid = studentId();
    }
    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash: await hashPassword(String(body.password)),
        role: "STUDENT",
        isActive: true,
      },
    });
    const student = await db.student.create({
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
    if (verifiedOtpId) {
      await db.otpRequest.update({ where: { id: verifiedOtpId }, data: { consumed: true } }).catch(() => null);
    }
    const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: "STUDENT" });
    if (!token) return fail("Registration needs SESSION_SECRET.", 503);
    const res = ok({
      user: sanitizeUser({ id: user.id, name: user.name, email: user.email, role: user.role }),
      student: { id: student.id, studentId: student.studentId, name: student.name },
    }, 201);
    res.headers.set("Set-Cookie", sessionCookieHeader(token));
    return res;
  } catch (err) {
    return serverError("auth:student-register", err);
  }
}
