// Phase 4 — server-side session (HMAC-signed HTTP-only cookie).
// SERVER-ONLY: never import from client components (uses node:crypto).
// Token format: base64url(payload).base64url(hmac_sha256(payload, secret))
// Payload: { id, email, name, role, exp }. No password data anywhere.
// Requires SESSION_SECRET — all helpers fail closed (null / 503) without it.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { AppRole, SessionUser } from "@/lib/server-auth";

export const SESSION_COOKIE = "neuron_session";
export const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function b64urlDecode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function getSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 16 ? s : null;
}

export function isAuthConfigured(): boolean {
  return getSecret() !== null;
}

export interface SessionPayload extends SessionUser {
  name: string;
  exp: number;
}

/** Create a signed token. Returns null when SESSION_SECRET is missing. */
export function createSessionToken(user: SessionUser & { name: string }): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const payload: SessionPayload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC };
  const body = b64urlEncode(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

/** Verify a token. Returns the user or null (bad signature/expired/misconfigured). */
export function verifySessionToken(token: string | undefined | null): SessionUser & { name: string } | null {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const expected = sign(body, secret);
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(body)) as SessionPayload;
    if (!payload.id || !payload.email || !payload.role) return null;
    if (payload.role !== "ADMIN" && payload.role !== "FACULTY" && payload.role !== "STUDENT") return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return { id: payload.id, email: payload.email, name: payload.name ?? "", role: payload.role as AppRole };
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

/** Read the session user from a route handler request. */
export function getUserFromRequest(req: NextRequest): (SessionUser & { name: string }) | null {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

/** Read the session user from a server component / server action context. */
export async function getCurrentUser(): Promise<(SessionUser & { name: string }) | null> {
  try {
    const store = await cookies();
    return verifySessionToken(store.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export function sessionCookieHeader(token: string): string {
  const opts = cookieOptions();
  return `${SESSION_COOKIE}=${token}; Path=${opts.path}; Max-Age=${opts.maxAge}; HttpOnly; SameSite=Lax${opts.secure ? "; Secure" : ""}`;
}

export function clearSessionCookieHeader(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}
