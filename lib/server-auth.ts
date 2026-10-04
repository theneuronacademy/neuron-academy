// Phase 4 — server-side auth helpers (real session enforcement).
// Demo logins (lib/adminAuth.ts, lib/studentAuth.ts localStorage) still drive
// the UI layer; THESE helpers protect data on the server and must be used in
// every sensitive API route + middleware. They fail closed without
// SESSION_SECRET / DATABASE_URL — never crash, never pretend.

import type { NextRequest } from "next/server";
import { getCurrentUser, getUserFromRequest, isAuthConfigured } from "@/lib/session";

export type AppRole = "ADMIN" | "FACULTY" | "STUDENT";

export interface SessionUser {
  id: string;
  email: string;
  role: AppRole;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeUser<T extends Record<string, any>>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash: _removed, ...rest } = user;
  void _removed;
  return rest;
}

/** Session user (or null) in server components / server actions. */
export async function getSession(): Promise<(SessionUser & { name: string }) | null> {
  return getCurrentUser();
}

/** Require any authenticated user. */
export async function requireAuth(): Promise<{ ok: true; user: SessionUser & { name: string } } | { ok: false; error: string; status: number }> {
  if (!isAuthConfigured()) return { ok: false, error: "Authentication is not configured.", status: 503 };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated.", status: 401 };
  return { ok: true, user };
}

/** Require one of the given roles (server components / actions). */
export async function requireRole(
  roles: AppRole[]
): Promise<{ ok: true; user: SessionUser & { name: string } } | { ok: false; error: string; status: number }> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!roles.includes(auth.user.role)) return { ok: false, error: "Forbidden.", status: 403 };
  return auth;
}

/**
 * Require a role inside an API route handler (uses req.cookies — Edge/Node safe).
 * Returns 503 when auth is unconfigured, 401 when unauthenticated, 403 on role mismatch.
 */
export function requireApiRole(
  req: NextRequest,
  roles: AppRole[]
): { ok: true; user: SessionUser & { name: string } } | { ok: false; error: string; status: number } {
  if (!isAuthConfigured()) return { ok: false, error: "Authentication is not configured.", status: 503 };
  const user = getUserFromRequest(req);
  if (!user) return { ok: false, error: "Not authenticated.", status: 401 };
  if (!roles.includes(user.role)) return { ok: false, error: "Forbidden.", status: 403 };
  return { ok: true, user };
}
