// Phase 10 — server-side credential helpers (never import from clients).
// - Mobile numbers normalized to canonical +<digits> (India default +91).
// - DOB accepted strictly as YYYY-MM-DD, verified as a real calendar date.
// - DOB credential stored as bcrypt(SESSION_SECRET + dob) — peppered so a
//   database read alone cannot brute-force the small date space.
// - Nothing here logs or returns credential material.

import bcrypt from "bcryptjs";

/** Canonical +<digits> or null. Default country code 91 for 10-digit mobiles. */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]\d{9}$/.test(d)) d = "91" + d;
  if (!/^\d{11,15}$/.test(d)) return null;
  return "+" + d;
}

/** Strict YYYY-MM-DD calendar date between 1900 and today, or null. */
export function normalizeDob(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (dt.getTime() > Date.now()) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function isValidPassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= 8 && pw.length <= 128;
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(pw, hash);
  } catch {
    return false;
  }
}

function pepper(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET not configured.");
  return s;
}

/** One-way DOB credential. Throws when SESSION_SECRET is missing. */
export async function hashDob(dobISO: string): Promise<string> {
  return bcrypt.hash(`${pepper()}|${dobISO}`, 12);
}

export async function verifyDob(dobISO: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(`${pepper()}|${dobISO}`, hash);
  } catch {
    return false;
  }
}

/** Random unusable password hash for accounts that log in via DOB only. */
export async function unusablePasswordHash(): Promise<string> {
  const rand = `${Date.now()}:${Math.random().toString(36).slice(2)}:${Math.random().toString(36).slice(2)}`;
  return bcrypt.hash(`unusable|${rand}`, 10);
}
