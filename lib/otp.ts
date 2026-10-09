// Phase 13 — server-side OTP security helpers (SERVER-ONLY: uses node:crypto).
// - Plaintext OTPs are NEVER stored: only a peppered SHA-256 hash.
// - OTPs are never returned in API responses and never logged.
// - Enforced: expiry, per-code attempt limit, resend cooldown, hourly cap.

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SEC = 60;
export const OTP_MAX_SEND_PER_HOUR = 5;
export const OTP_VERIFIED_TTL_MIN = 10;

export function otpExpiryMinutes(): number {
  const raw = Number(process.env.MSG91_OTP_EXPIRY ?? 5);
  if (!Number.isFinite(raw) || raw < 1) return 5;
  return Math.min(30, Math.floor(raw));
}

/** Strict Indian mobile: 10 digits starting 6–9, optional 91 / 0 / +91 prefix. */
export function normalizeIndianMobile(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let d = input.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  return "+91" + d;
}

/** 91-prefixed digits for MSG91 (no plus). */
export function toMsg91Mobile(canonical: string): string {
  return canonical.replace(/\D/g, "");
}

function pepper(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET not configured.");
  return s;
}

/** Cryptographically random numeric OTP. */
export function generateOtp(length = OTP_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String(randomInt(0, 10));
  // Avoid trivial codes (all same digit).
  if (/^(\d)\1+$/.test(out)) return generateOtp(length);
  return out;
}

/** Peppered SHA-256 hash — the ONLY form in which an OTP is persisted. */
export function hashOtp(otp: string, phone: string): string {
  return createHash("sha256").update(`${pepper()}|${phone}|${otp}`).digest("hex");
}

/** Timing-safe comparison of a candidate OTP against a stored hash. */
export function verifyOtpHash(candidate: string, phone: string, storedHash: string): boolean {
  try {
    const a = Buffer.from(hashOtp(candidate, phone), "hex");
    const b = Buffer.from(storedHash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Accept 4–8 digit codes; anything else is rejected before hashing. */
export function isOtpFormat(v: unknown): v is string {
  return typeof v === "string" && /^\d{4,8}$/.test(v.trim());
}

/**
 * Phase 18 — masked phone for SAFE server logs only. Never log the full
 * phone number: keep country prefix + last 2 digits (e.g. +91******12).
 * Logs must never contain OTP values, API keys, or full phone numbers.
 */
export function maskPhone(canonical: string): string {
  const digits = canonical.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  const cc = digits.length > 10 ? digits.slice(0, digits.length - 10) : "";
  return `+${cc}******${digits.slice(-2)}`;
}
