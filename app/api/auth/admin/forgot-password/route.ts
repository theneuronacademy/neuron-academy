// Phase 20 — admin password reset request (send OTP to registered mobile).
// Only sends OTP if mobile is registered to an active ADMIN account.
// Generic response either way — no enumeration.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { normalizeIndianMobile } from "@/lib/otp";
import { sendOtp, OTP_CONFIGURATION_ERROR } from "@/services/msg91";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Requesting admin password reset OTP");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["phone"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  const phone = normalizeIndianMobile(body.phone);
  if (!phone) return fail("Enter a valid 10-digit Indian mobile number.", 400);

  try {
    // Verify admin exists and is active — generic response either way
    const user = await db.user.findFirst({ where: { phone, role: "ADMIN" } });
    if (!user || !user.isActive) {
      return ok({ sent: true });
    }

    if (!sendOtp) {
      return fail("OTP service is not configured.", 503, OTP_CONFIGURATION_ERROR);
    }
    const sent = await sendOtp(phone);
    if (!sent.ok) {
      return fail(sent.error ?? "Could not send the OTP.", 502, sent.code);
    }
    return ok({ sent: true, expiresInSec: 5 * 60 });
  } catch (err) {
    return serverError("auth:admin-forgot-password", err);
  }
}
