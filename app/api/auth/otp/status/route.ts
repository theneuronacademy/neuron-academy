// Phase 13 — public OTP capability flag. Tells the registration UI whether
// the mobile-OTP step is required. Exposes no secrets, only a boolean.

import { ok } from "@/lib/api-response";
import { isMsg91Configured } from "@/services/msg91";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({ otpRequired: isMsg91Configured() });
}
