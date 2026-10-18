// Phase 21 — TOTP (2FA) Service
// Implements RFC 6238 TOTP for student 2FA

import { createHmac } from "crypto";
import { randomBytes } from "crypto";

/** Generate a random base32 secret for TOTP */
export function generateTotpSecret(): string {
  const bytes = randomBytes(20); // 160 bits
  return base32Encode(bytes);
}

/** Encode bytes to base32 (RFC 4648, no padding) */
function base32Encode(bytes: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Verify a TOTP token against a secret */
export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const now = Math.floor(Date.now() / 1000 / 30);
  const cleanToken = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleanToken)) return false;

  for (let i = -window; i <= window; i++) {
    const expected = generateTotp(secret, now + i);
    if (timingSafeEqual(cleanToken, expected)) return true;
  }
  return false;
}

/** Generate TOTP for a given time step */
function generateTotp(secret: string, timeStep: number): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(timeStep), 0);
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

/** Decode base32 (RFC 4648) */
function base32Decode(str: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Timing-safe string comparison */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Generate backup codes (8 codes, 8 chars each) */
export function generateBackupCodes(count = 8, length = 8): string[] {
  const codes: string[] = [];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No confusing chars
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < length; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    codes.push(code);
  }
  return codes;
}

/** Verify a backup code and remove it from the list */
export function verifyAndConsumeBackupCode(codes: string[], input: string): { valid: boolean; remaining: string[] } {
  const clean = input.trim().toUpperCase().replace(/\s/g, "");
  const idx = codes.findIndex(c => c === clean);
  if (idx === -1) return { valid: false, remaining: codes };
  const remaining = [...codes.slice(0, idx), ...codes.slice(idx + 1)];
  return { valid: true, remaining };
}

/** Generate otpauth:// URI for QR code */
export function generateTotpUri(secret: string, accountName: string, issuer = "Neuron Academy"): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}