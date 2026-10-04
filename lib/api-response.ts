// Phase 3 — consistent API response envelope.
// Success: { success: true, data: {} }
// Error:   { success: false, error: "Readable message" }
// Never leak DB internals, stacks, or secrets to the client.

import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: string, status = 500) {
  return NextResponse.json({ success: false, error }, { status });
}

/** 503 for write attempts when DATABASE_URL is not configured. */
export function dbNotConfigured(action = "This action") {
  return fail(`${action} needs a database. Set DATABASE_URL to enable it — demo mode is read-only.`, 503);
}

/** Log server-side detail, return a safe client message. */
export function serverError(scope: string, err: unknown) {
  console.error(`[api:${scope}]`, err instanceof Error ? err.message : err);
  return fail("Server error. Please try again later.", 500);
}
