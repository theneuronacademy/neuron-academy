// Phase 13 — MSG91 OTP service abstraction (SERVER-ONLY).
// - API keys NEVER leave the server: no key in responses, logs, or client code.
// - The plaintext OTP is generated in memory, sent via MSG91, and only its
//   peppered hash is persisted (see lib/otp.ts). Nothing is logged.
// - Without credentials every function fails HONESTLY with
//   MSG91_NOT_CONFIGURED — success is never faked.
// - Production delivery additionally requires an approved DLT template whose
//   variable carries the OTP (TEMPLATE_ID) and a registered sender (SENDER_ID).

import { generateOtp, hashOtp, otpExpiryMinutes, toMsg91Mobile } from "@/lib/otp";

export const MSG91_NOT_CONFIGURED = "MSG91_NOT_CONFIGURED";

export interface Msg91Result {
  ok: boolean;
  code: string;
  error?: string;
}

function credentials(): { key: string; templateId: string; sender: string } | null {
  const key = process.env.MSG91_AUTH_KEY ?? "";
  const templateId = process.env.MSG91_TEMPLATE_ID ?? "";
  const sender = process.env.MSG91_SENDER_ID ?? "";
  if (!key || !templateId || !sender) return null;
  return { key, templateId, sender };
}

/** True when all MSG91 credentials are present. */
export function isMsg91Configured(): boolean {
  return credentials() !== null;
}

/**
 * Generate a fresh OTP, send it through MSG91, and return the hash to persist.
 * The plaintext OTP is returned ONLY to this server caller so it can hash +
 * store it — callers must never forward it to the client.
 */
export async function sendOtp(
  canonicalPhone: string
): Promise<(Msg91Result & { otp?: string; otpHash?: string }) | { ok: false; code: string; error: string }> {
  const creds = credentials();
  if (!creds) {
    return { ok: false, code: MSG91_NOT_CONFIGURED, error: "OTP service is not configured. Set MSG91 credentials to enable mobile verification." };
  }
  const otp = generateOtp();
  const mobiles = toMsg91Mobile(canonicalPhone);
  const params = new URLSearchParams({
    authkey: creds.key,
    mobile: mobiles,
    template_id: creds.templateId,
    sender: creds.sender,
    otp,
    otp_expiry: String(otpExpiryMinutes()),
  });
  try {
    const res = await fetch(`https://api.msg91.com/api/v5/otp?${params.toString()}`, { method: "POST" });
    const json = (await res.json().catch(() => null)) as { type?: string; message?: string } | null;
    if (!res.ok || !json || json.type !== "success") {
      return { ok: false, code: "MSG91_SEND_FAILED", error: "Could not send the OTP. Please try again in a minute." };
    }
    return { ok: true, code: "SENT", otp, otpHash: hashOtp(otp, canonicalPhone) };
  } catch {
    return { ok: false, code: "MSG91_SEND_FAILED", error: "Could not reach the OTP service. Please try again." };
  }
}
