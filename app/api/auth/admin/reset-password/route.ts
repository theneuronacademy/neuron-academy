// Phase 20 — admin password reset verify (verify OTP and set new password).
// Verifies OTP against registered mobile, then updates the admin password.
// Uses a short-lived, single-use OTP authorization. Never creates an admin
// during recovery; never grants admin privileges via student OTP.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { normalizeIndianMobile, verifyOtpHash, isOtpFormat } from "@/lib/otp";
import { hashPassword, isValidPassword } from "@/lib/credentials";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const GENERIC = "Invalid or expired OTP.";

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Resetting admin password");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["phone", "otp", "password"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  const phone = normalizeIndianMobile(body.phone);
  if (!phone || !isOtpFormat(body.otp) || !isValidPassword(body.password)) {
    return fail(GENERIC, 400, "OTP_INVALID");
  }
  const otp = String(body.otp).trim();
  const newPassword = String(body.password);

  try {
    // Find the latest OTP request for this phone
    const row = await db.otpRequest.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return fail(GENERIC, 400, "OTP_INVALID");
    if (row.consumed) {
      return fail("This OTP has already been used. Request a new one.", 409, "OTP_ALREADY_USED");
    }
    if (row.verifiedAt) {
      return fail("This OTP has already been used. Request a new one.", 409, "OTP_ALREADY_USED");
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      return fail(GENERIC, 400, "OTP_EXPIRED");
    }
    if (row.attempts >= 5) {
      return fail("Too many wrong attempts. Request a new OTP.", 429, "OTP_RATE_LIMITED");
    }
    if (!row.otpHash || !verifyOtpHash(otp, phone, row.otpHash)) {
      await db.otpRequest.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }).catch(() => null);
      return fail(GENERIC, 400, "OTP_INVALID");
    }

    // OTP verified — mark as verified and consume
    await db.otpRequest.update({ where: { id: row.id }, data: { verifiedAt: new Date(), attempts: 0 } });

    // Find admin and update password
    const user = await db.user.findFirst({ where: { phone, role: "ADMIN" } });
    if (!user) {
      return fail("Admin account not found.", 404);
    }
    if (!user.isActive) {
      return fail("This account is deactivated. Contact the academy office.", 403);
    }

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    // Mark OTP as consumed
    await db.otpRequest.update({ where: { id: row.id }, data: { consumed: true } }).catch(() => null);

    return ok({ reset: true });
  } catch (err) {
    return serverError("auth:admin-reset-password", err);
  }
}
