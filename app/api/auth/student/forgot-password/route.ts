// Phase 19 — student password reset request (send OTP to registered mobile).
// Only sends OTP if mobile is registered to an active student account.

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
  if (!db) return dbNotConfigured("Requesting password reset OTP");
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
    // Verify student exists and is active
    const student = await db.student.findFirst({ where: { phone }, include: { user: true } });
    if (!student || !student.user || student.user.role !== "STUDENT") {
      // Don't reveal whether mobile is registered — same response either way
      return ok({ sent: true });
    }
    if (!student.user.isActive) {
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
    return serverError("auth:student-forgot-password", err);
  }
}