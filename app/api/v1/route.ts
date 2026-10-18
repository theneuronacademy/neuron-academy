// Phase 19 — API v1 Router
// Central entry point for versioned API routes

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    version: "v1",
    status: "active",
    endpoints: {
      admin: "/api/v1/admin",
      auth: "/api/v1/auth",
      tests: "/api/v1/tests",
      students: "/api/v1/students",
      notifications: "/api/v1/notifications",
      books: "/api/v1/books",
      attendance: "/api/v1/attendance",
      biometric: "/api/v1/biometric",
    },
    deprecated: [],
    sunset: null,
  });
}