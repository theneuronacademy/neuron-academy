// Phase 18 — OTP verification (public registration step).
// Binds verification to the canonical phone: the latest OtpRequest row for
// that phone decides the outcome, with distinct safe codes:
// - no row / bad format ......... OTP_INVALID (400, generic message)
// - wrong code .................. OTP_INVALID (400, generic message)
// - expired ..................... OTP_EXPIRED (400, generic message)
// - consumed or already verified  OTP_ALREADY_USED (409)
// - too many wrong attempts ..... OTP_RATE_LIMITED (429)
// Comparison is against the peppered hash (timing-safe). A successful verify
// stamps verifiedAt, which invalidates the code for further verify calls
// (reuse → OTP_ALREADY_USED) while leaving registration — which consumes the
// verified row single-use — as the only next step. Generic messages reveal
// nothing about which part failed; codes let clients branch safely.

import { NextRequest } from "next/server";
import { fail, ok, serverError, dbNotConfigured } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { isOtpFormat, maskPhone, normalizeIndianMobile, OTP_MAX_ATTEMPTS, verifyOtpHash } from "@/lib/otp";

export const dynamic = "force-dynamic";
// Vercel: hash verify + DB writes + cold start headroom (Pro plan).
export const maxDuration = 15;

const GENERIC = "Invalid or expired OTP.";

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Verifying an OTP");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400, "OTP_INVALID");
  }
  const phone = normalizeIndianMobile(body.phone);
  if (!phone || !isOtpFormat(body.otp)) return fail(GENERIC, 400, "OTP_INVALID");
  const otp = String(body.otp).trim();
  try {
    // Latest row for this phone — including expired/consumed/verified — so
    // each terminal state maps to its honest code instead of a generic miss.
    const row = await db.otpRequest.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return fail(GENERIC, 400, "OTP_INVALID");
    if (row.consumed) {
      return fail("This OTP has already been used. Request a new one.", 409, "OTP_ALREADY_USED");
    }
    if (row.verifiedAt) {
      // Successfully verified codes cannot verify again; registration
      // consumes the verified row single-use.
      return fail("This OTP has already been used. Request a new one.", 409, "OTP_ALREADY_USED");
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      return fail(GENERIC, 400, "OTP_EXPIRED");
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      console.warn(`[otp:ratelimit] verify attempts exhausted for ${maskPhone(phone)}`);
      return fail("Too many wrong attempts. Request a new OTP.", 429, "OTP_RATE_LIMITED");
    }
    if (!verifyOtpHash(otp, phone, row.otpHash)) {
      await db.otpRequest.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }).catch(() => null);
      return fail(GENERIC, 400, "OTP_INVALID");
    }
    await db.otpRequest.update({ where: { id: row.id }, data: { verifiedAt: new Date(), attempts: 0 } });
    return ok({ verified: true });
  } catch (err) {
    return serverError("auth:otp-verify", err);
  }
}
