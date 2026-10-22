// Phase 19 — public OTP configuration probe (secret-free).
// Returns booleans so the client can choose the primary verification
// path without exposing any MSG91 credentials. No database, no network.
import { ok } from "@/lib/api-response";
import { isDirectOtpConfigured, isWidgetConfigured } from "@/services/msg91";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return ok({
    directOtpConfigured: isDirectOtpConfigured(),
    widgetConfigured: isWidgetConfigured(),
  });
}
