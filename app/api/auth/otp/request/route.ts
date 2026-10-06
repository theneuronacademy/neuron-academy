// Phase 13 — OTP request (public registration step, heavily rate-limited).
// Validates Indian mobile → enforces resend cooldown + hourly cap → sends via
// MSG91 → persists ONLY the peppered hash. The OTP never appears in any
// response and is never logged. Without MSG91 credentials: honest 503
// MSG91_NOT_CONFIGURED — success is never faked.

import { NextRequest } from "next/server";
import { fail, ok, serverError, dbNotConfigured } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import {
  normalizeIndianMobile,
  otpExpiryMinutes,
  OTP_MAX_SEND_PER_HOUR,
  OTP_RESEND_COOLDOWN_SEC,
} from "@/lib/otp";
import { isMsg91Configured, MSG91_NOT_CONFIGURED, sendOtp } from "@/services/msg91";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Requesting an OTP");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const phone = normalizeIndianMobile(body.phone);
  if (!phone) return fail("Enter a valid 10-digit Indian mobile number.", 400);
  if (!isMsg91Configured()) {
    return fail("OTP service is not configured.", 503);
  }
  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await db.otpRequest.count({ where: { phone, createdAt: { gte: hourAgo } } });
    if (recentCount >= OTP_MAX_SEND_PER_HOUR) {
      return fail("Too many OTP requests. Please try again after an hour.", 429);
    }
    const latest = await db.otpRequest.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
    if (latest && Date.now() - latest.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_SEC * 1000) {
      const wait = OTP_RESEND_COOLDOWN_SEC - Math.floor((Date.now() - latest.lastSentAt.getTime()) / 1000);
      return fail(`Please wait ${wait}s before requesting another OTP.`, 429);
    }
    const sent = await sendOtp(phone);
    if (!sent.ok || typeof sent.otpHash !== "string") {
      const status = !sent.ok && sent.code === MSG91_NOT_CONFIGURED ? 503 : 502;
      return fail(sent.ok ? "Could not send the OTP." : (sent.error ?? "Could not send the OTP."), status);
    }
    const expiryMin = otpExpiryMinutes();
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
