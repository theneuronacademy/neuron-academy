// Phase 18 — MSG91 OTP service abstraction (SERVER-ONLY).
// Phase 18b — also the transactional SmsProvider behind the notification
// engine (ChannelRouter → SmsProvider → Msg91Provider). Two operations:
//   sendOtp(phone) ............ OTP endpoint (verified contract, DLT template
//                             MSG91_TEMPLATE_ID + sender MSG91_SENDER_ID).
//   sendSms(phone, flowId, vars) transactional Flow API v5 (per-template
//                             MSG91_FLOW_ID_<KEY> + sender). NOT live-verified
//                             yet — honest errors until the first live SMS.
// - API keys NEVER leave the server: no key in responses, logs, or client code.
// - The plaintext OTP is generated in memory, sent via MSG91, and only its
//   peppered hash is persisted (see lib/otp.ts). Nothing secret is logged.
// - Without credentials every function fails HONESTLY with
//   OTP_CONFIGURATION_ERROR (alias MSG91_NOT_CONFIGURED) — success is never faked.
// - Production delivery additionally requires an approved DLT template whose
//   variable carries the OTP (MSG91_TEMPLATE_ID) and a registered sender
//   (MSG91_SENDER_ID), both configured as environment variables.
// - MSG91 OTP contract used: POST https://api.msg91.com/api/v5/otp with query
//   params authkey, mobile (91-prefixed digits), template_id, sender, otp,
//   otp_expiry (minutes). Success = HTTP 2xx + body { type: "success" }.
//   Raw provider payloads are never forwarded to clients.
// - MSG91 Flow contract used for transactional SMS: POST
//   https://api.msg91.com/api/v5/flow/ with authkey header and JSON body
//   { flow_id, sender, mobiles, <VAR>: value }. Success = HTTP 2xx + body
//   { type: "success" }. Retries: only transient (timeout/network/5xx) are
//   marked retryable — never auth/template/invalid errors.
// - ONE attempt per call with an explicit timeout — no retry loops here, so
//   resend/cooldown at the route layer can never trigger SMS spam.

import { generateOtp, hashOtp, maskPhone, otpExpiryMinutes, toMsg91Mobile } from "@/lib/otp";

// Legacy code kept for backwards compatibility; prefer OTP_CONFIGURATION_ERROR.
export const MSG91_NOT_CONFIGURED = "MSG91_NOT_CONFIGURED";
export const OTP_CONFIGURATION_ERROR = "OTP_CONFIGURATION_ERROR";
export const OTP_PROVIDER_ERROR = "OTP_PROVIDER_ERROR";

/** MSG91 send timeout: fail honestly instead of hanging a serverless call. */
export const MSG91_TIMEOUT_MS = 10_000;

export interface Msg91Result {
  ok: boolean;
  code: string;
  error?: string;
  /** True only for transient faults (timeout/network/5xx). Never retry auth, template, or invalid-recipient errors. */
  retryable?: boolean;
}

export const SMS_NOT_CONFIGURED = "SMS_NOT_CONFIGURED";
export const SMS_TEMPLATE_NOT_CONFIGURED = "SMS_TEMPLATE_NOT_CONFIGURED";
export const SMS_PROVIDER_ERROR = "SMS_PROVIDER_ERROR";
export const SMS_INVALID_RECIPIENT = "SMS_INVALID_RECIPIENT";

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
 * store it — callers must never forward it to the client, and must never log it.
 * On any MSG91 rejection/network error the DB caller must persist NOTHING.
 */
export async function sendOtp(
  canonicalPhone: string
): Promise<(Msg91Result & { otp?: string; otpHash?: string }) | { ok: false; code: string; error: string }> {
  const creds = credentials();
  if (!creds) {
    return { ok: false, code: OTP_CONFIGURATION_ERROR, error: "OTP service is not configured. Set MSG91 credentials to enable mobile verification." };
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MSG91_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.msg91.com/api/v5/otp?${params.toString()}`, {
      method: "POST",
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as { type?: string; message?: string } | null;
    if (!res.ok || !json || json.type !== "success") {
      // Safe diagnostic only: HTTP status + provider type. NEVER log the key,
      // the OTP, the full phone, headers, or the raw provider body.
      console.error(`[otp:provider] send failed for ${maskPhone(canonicalPhone)} status=${res.status} type=${json?.type ?? "unknown"}`);
      return { ok: false, code: OTP_PROVIDER_ERROR, error: "Could not send the OTP. Please try again in a minute.", retryable: res.status >= 500 };
    }
    return { ok: true, code: "SENT", otp, otpHash: hashOtp(otp, canonicalPhone) };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    console.error(`[otp:provider] ${timedOut ? "timeout" : "unreachable"} for ${maskPhone(canonicalPhone)}`);
    return { ok: false, code: OTP_PROVIDER_ERROR, error: "Could not reach the OTP service. Please try again.", retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Phase 18b — transactional SMS via MSG91 Flow API v5 (NOT live-verified).
 * Sends template `flowId` content to one recipient. `vars` are the Flow
 * template variables (VAR1..). One attempt, explicit timeout, normalized
 * result with a retryable hint (transient only). NEVER throws.
 * Callers: notification engine only — never from client code, never with
 * secrets in logs. Invalid recipient → SMS_INVALID_RECIPIENT (never retry).
 */
export async function sendSms(
  canonicalPhone: string,
  flowId: string,
  vars: Record<string, string>
): Promise<Msg91Result> {
  const key = process.env.MSG91_AUTH_KEY ?? "";
  const sender = process.env.MSG91_SENDER_ID ?? "";
  if (!key || !sender) {
    return { ok: false, code: SMS_NOT_CONFIGURED, error: "SMS service is not configured.", retryable: false };
  }
  if (!flowId) {
    return { ok: false, code: SMS_TEMPLATE_NOT_CONFIGURED, error: "SMS template is not configured.", retryable: false };
  }
  if (!/^\+?\d{11,15}$/.test(canonicalPhone)) {
    return { ok: false, code: SMS_INVALID_RECIPIENT, error: "Invalid recipient number.", retryable: false };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MSG91_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { authkey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: flowId, sender, mobiles: toMsg91Mobile(canonicalPhone), ...vars }),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as { type?: string } | null;
    if (!res.ok || !json || json.type !== "success") {
      // Safe diagnostic only: status + provider type. NEVER the key, phone,
      // flow content, headers, or raw provider body.
      console.error(`[sms:provider] send failed for ${maskPhone(canonicalPhone)} status=${res.status} type=${json?.type ?? "unknown"}`);
      const retryable = res.status >= 500 || res.status === 429;
      return { ok: false, code: SMS_PROVIDER_ERROR, error: "Could not send the SMS.", retryable };
    }
    return { ok: true, code: "SENT", retryable: false };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    console.error(`[sms:provider] ${timedOut ? "timeout" : "unreachable"} for ${maskPhone(canonicalPhone)}`);
    return { ok: false, code: SMS_PROVIDER_ERROR, error: "Could not reach the SMS service.", retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Widget token verification result.
 */
export interface WidgetVerifyResult {
  ok: boolean;
  code: string;
  error?: string;
  /** Canonical phone number from the widget token (e.g., +919876543210). */
  phone?: string;
  /** True only for transient faults (timeout/network/5xx). Never retry auth, template, or invalid-recipient errors. */
  retryable?: boolean;
}

const WIDGET_VERIFY_TIMEOUT_MS = 10_000;
export { WIDGET_VERIFY_TIMEOUT_MS };
export const WIDGET_VERIFY_ERROR = "WIDGET_VERIFY_ERROR";
export const WIDGET_TOKEN_INVALID = "WIDGET_TOKEN_INVALID";
export const WIDGET_CONFIGURATION_ERROR = "WIDGET_CONFIGURATION_ERROR";

/**
 * Verify a widget access token with MSG91.
 * The widget returns a JWT access token after successful OTP verification on the client side.
 * This server-side call validates that token with MSG91 before creating a local session.
 * Requires only MSG91_AUTH_KEY (not TEMPLATE_ID, SENDER_ID, or FLOW_ID).
 */
export async function verifyWidgetToken(
  accessToken: string
): Promise<WidgetVerifyResult> {
  const authKey = process.env.MSG91_AUTH_KEY ?? "";
  if (!authKey) {
    return { ok: false, code: WIDGET_CONFIGURATION_ERROR, error: "MSG91 widget verification is not configured. Set MSG91_AUTH_KEY to enable it." };
  }
  if (!accessToken || typeof accessToken !== "string" || accessToken.trim().length === 0) {
    return { ok: false, code: WIDGET_TOKEN_INVALID, error: "Invalid or missing access token." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WIDGET_VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authkey: authKey, "access-token": accessToken.trim() }),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as { type?: string; message?: string; mobile?: string } | null;
    if (!res.ok || !json || json.type !== "success") {
      // Safe diagnostic only: HTTP status + provider type. NEVER log the authkey, token, or raw provider body.
      const providerIdentifier = json?.mobile ?? json?.message;
      const masked = providerIdentifier ? maskPhone("+91" + providerIdentifier.replace(/\D/g, "")) : "unknown";
      console.error(`[widget:verify] failed for ${masked} status=${res.status} type=${json?.type ?? "unknown"}`);
      return { ok: false, code: WIDGET_VERIFY_ERROR, error: "Could not verify the token. Please try again.", retryable: res.status >= 500 };
    }
    // MSG91 returns mobile as 10-digit or 91-prefixed; normalize to canonical +91...
    // MSG91's current verifyAccessToken response returns the verified mobile
    // identifier in `message`; retain `mobile` support for older responses.
    const rawMobile = String(json.mobile ?? json.message ?? "").replace(/\D/g, "");
    let canonical = "";
    if (rawMobile.length === 10 && /^[6-9]\d{9}$/.test(rawMobile)) {
      canonical = "+91" + rawMobile;
    } else if (rawMobile.length === 12 && rawMobile.startsWith("91")) {
      canonical = "+" + rawMobile;
    } else if (rawMobile.length === 11 && rawMobile.startsWith("0")) {
      canonical = "+91" + rawMobile.slice(1);
    }
    if (!canonical) {
      return { ok: false, code: WIDGET_VERIFY_ERROR, error: "Unexpected mobile format from provider." };
    }
    return { ok: true, code: "VERIFIED", phone: canonical };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    console.error(`[widget:verify] ${timedOut ? "timeout" : "unreachable"}`);
    return { ok: false, code: WIDGET_VERIFY_ERROR, error: "Could not reach the verification service.", retryable: true };
  } finally {
    clearTimeout(timer);
  }
}
