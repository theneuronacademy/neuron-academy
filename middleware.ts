// Phase 4 — Edge middleware: role-based route protection.
// - Runs on /admin/*, /faculty/*, /student/* only. Public routes (/, /courses/*,
//   /faculty/[slug] profiles, logins) pass through untouched.
// - Verifies the HMAC session cookie with WebCrypto (Edge-safe, no Node APIs).
// - P0 fail-closed: in production without a usable SESSION_SECRET no session
//   can verify, so every protected route redirects to login. Development
//   (NODE_ENV !== "production") keeps the demo pass-through so the demo UI
//   stays usable without a secret. Never crashes, never exposes secrets or
//   token contents (only the role string leaves verifyRole).

import { NextRequest, NextResponse } from "next/server";

const COOKIE = "neuron_session";

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlDecodeJson(s: string): { exp?: number; role?: string } | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function verifyRole(token: string, secret: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), new TextEncoder().encode(body));
    if (!valid) return null;
    const payload = b64urlDecodeJson(body);
    if (!payload || typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function loginRedirect(req: NextRequest, loginPath: string): NextResponse {
  const url = new URL(loginPath, req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.SESSION_SECRET;
  const secretValid = !!secret && secret.length >= 16;
  // P0: without a usable secret no session can verify. Production fails
  // closed (protected routes redirect to login below); development keeps
  // the demo pass-through (page-level demo guards still apply).
  if (!secretValid && process.env.NODE_ENV !== "production") return NextResponse.next();

  // Public login/register pages always pass.
  if (
    pathname === "/admin/login" ||
    pathname === "/student/login" ||
    pathname === "/student/register"
  ) {
    return NextResponse.next();
  }

  // Without a usable secret no token can verify — treat every caller as
  // unauthenticated so production fails closed (login redirect below).
  const role = secretValid ? await verifyRole(req.cookies.get(COOKIE)?.value ?? "", secret as string) : null;

  if (pathname.startsWith("/admin")) {
    if (!role) return loginRedirect(req, "/admin/login");
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (pathname.startsWith("/student")) {
    if (!role) return loginRedirect(req, "/student/login");
    if (role !== "STUDENT" && role !== "ADMIN") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*"],
};
