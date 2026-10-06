// Phase 13 — OTP verification (public registration step).
// Checks expiry + per-code attempt limit server-side, compares against the
// peppered hash (timing-safe). Generic errors reveal nothing about which
// part failed. Verified codes are consumed by registration (single use).

import { NextRequest } from "next/server";
import { fail, ok, serverError, dbNotConfigured } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { isOtpFormat, normalizeIndianMobile, OTP_MAX_ATTEMPTS, verifyOtpHash } from "@/lib/otp";

export const dynamic = "force-dynamic";

const GENERIC = "Invalid or expired OTP.";

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Verifying an OTP");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const phone = normalizeIndianMobile(body.phone);
  if (!phone || !isOtpFormat(body.otp)) return fail(GENERIC, 400);
  const otp = String(body.otp).trim();
  try {
    const row = await db.otpRequest.findFirst({
      where: { phone, consumed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return fail(GENERIC, 400);
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      return fail("Too many wrong attempts. Request a new OTP.", 429);
    }
    if (!verifyOtpHash(otp, phone, row.otpHash)) {
      await db.otpRequest.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }).catch(() => null);
      return fail(GENERIC, 400);
    }
    await db.otpRequest.update({ where: { id: row.id }, data: { verifiedAt: new Date(), attempts: 0 } });
    return ok({ verified: true });
  } catch (err) {
    return serverError("auth:otp-verify", err);
  }
}
