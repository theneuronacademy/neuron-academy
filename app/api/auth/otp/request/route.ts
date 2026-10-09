// Phase 18 — OTP request (public registration step, heavily rate-limited).
// Validates Indian mobile → enforces resend cooldown + hourly cap → sends via
// MSG91 (server-side only) → persists ONLY the peppered hash. The OTP never
// appears in any response and is never logged. Without MSG91 credentials:
// honest 503 OTP_CONFIGURATION_ERROR — success is never faked.
// Resend supersedes: previous active (unconsumed, unexpired) OTPs for the
// phone are expired before the new row is created, so old codes cannot be
// abused and rows stay bounded (hourly cap + cooldown also enforced).

import { NextRequest } from "next/server";
import { fail, ok, serverError, dbNotConfigured } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import {
  normalizeIndianMobile,
  maskPhone,
  otpExpiryMinutes,
  OTP_MAX_SEND_PER_HOUR,
  OTP_RESEND_COOLDOWN_SEC,
} from "@/lib/otp";
import { isMsg91Configured, OTP_CONFIGURATION_ERROR, OTP_PROVIDER_ERROR, sendOtp } from "@/services/msg91";

export const dynamic = "force-dynamic";
// Vercel: external MSG91 fetch + rate-limit queries + cold start (Pro plan).
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Requesting an OTP");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400, "OTP_INVALID");
  }
  const phone = normalizeIndianMobile(body.phone);
  if (!phone) return fail("Enter a valid 10-digit Indian mobile number.", 400, "OTP_INVALID");
  if (!isMsg91Configured()) {
    return fail("OTP service is not configured.", 503, OTP_CONFIGURATION_ERROR);
  }
  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await db.otpRequest.count({ where: { phone, createdAt: { gte: hourAgo } } });
    if (recentCount >= OTP_MAX_SEND_PER_HOUR) {
      console.warn(`[otp:ratelimit] hourly cap for ${maskPhone(phone)}`);
      return fail("Too many OTP requests. Please try again after an hour.", 429, "OTP_RATE_LIMITED");
    }
    const latest = await db.otpRequest.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
    if (latest && Date.now() - latest.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_SEC * 1000) {
      const wait = OTP_RESEND_COOLDOWN_SEC - Math.floor((Date.now() - latest.lastSentAt.getTime()) / 1000);
      return fail(`Please wait ${wait}s before requesting another OTP.`, 429, "OTP_RATE_LIMITED");
    }
    const sent = await sendOtp(phone);
    if (!sent.ok || typeof sent.otpHash !== "string") {
      // MSG91 rejected or was unreachable: persist NOTHING, report honestly.
      // Never forward raw provider payloads; the service already logged a
      // safe diagnostic (masked phone + status only).
      const status = !sent.ok && sent.code === OTP_CONFIGURATION_ERROR ? 503 : 502;
      const code = !sent.ok ? sent.code : OTP_PROVIDER_ERROR;
      return fail(sent.ok ? "Could not send the OTP." : (sent.error ?? "Could not send the OTP."), status, code);
    }
    const expiryMin = otpExpiryMinutes();
    // Supersede previous active OTPs so only the newest code can verify.
    // Best-effort: a failure here must not block the fresh OTP.
    await db.otpRequest
      .updateMany({
        where: { phone, consumed: false, expiresAt: { gt: new Date() } },
        data: { expiresAt: new Date() },
      })
      .catch(() => null);
    await db.otpRequest.create({
      data: {
        phone,
        purpose: "REGISTER",
        otpHash: sent.otpHash,
        attempts: 0,
        resendCount: (latest?.resendCount ?? 0) + 1,
        expiresAt: new Date(Date.now() + expiryMin * 60 * 1000),
        lastSentAt: new Date(),
      },
    });
    return ok({ sent: true, expiresInSec: expiryMin * 60 });
  } catch (err) {
    return serverError("auth:otp-request", err);
  }
}
