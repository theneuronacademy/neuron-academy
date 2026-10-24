// Phase 3 — consistent API response envelope.
// Success: { success: true, data: {} }
// Error:   { success: false, error: "Readable message" }
// Never leak DB internals, stacks, or secrets to the client.

import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: string, status = 500, code?: string) {
  return NextResponse.json({ success: false, error, ...(code ? { code } : {}) }, { status });
}

/** 503 for write attempts when DATABASE_URL is not configured. */
export function dbNotConfigured(action = "This action") {
  return fail(`${action} needs a database. Set DATABASE_URL to enable it — demo mode is read-only.`, 503);
}

/** Log server-side detail (full object incl. stack), return a safe client message. */
export function serverError(scope: string, err: unknown) {
  console.error(`[api:${scope}]`, err);
  const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
  // Common Prisma request errors get actionable client messages instead of a
  // generic 500. Everything else stays generic (details live in server logs).
  if (code === "P2002") return fail("An entry with these details already exists.", 409, code);
  if (code === "P2003") return fail("The database is not reachable right now. Please try again.", 503, code);
  if (code === "P2024") return fail("The database is busy. Please try again in a moment.", 503, code);
  return fail("Server error. Please try again later.", 500, code ? code : undefined);
}
