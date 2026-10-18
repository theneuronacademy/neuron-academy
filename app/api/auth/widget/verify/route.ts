// Phase 19 — MSG91 Widget token verification (server-side).
// Client embeds MSG91 widget → widget returns JWT access-token → client POSTs here.
// Server verifies token with MSG91 (requires MSG91_AUTH_KEY only).
// On success: finds/creates student → issues session cookie.
// Never trusts client-side widget state alone. Never exposes MSG91_AUTH_KEY.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { sanitizeUser } from "@/lib/server-auth";
import { createSessionToken, isAuthConfigured, sessionCookieHeader } from "@/lib/session";
import { normalizeIndianMobile } from "@/lib/otp";
import { verifyWidgetToken, WIDGET_TOKEN_INVALID, WIDGET_CONFIGURATION_ERROR } from "@/services/msg91";

export const dynamic = "force-dynamic";
// Vercel: external verify call + DB + cold start headroom (Pro plan).
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Widget token verification");
  if (!isAuthConfigured()) return fail("Authentication needs SESSION_SECRET.", 503);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  if (!accessToken) return fail("Missing access token.", 400);

  const verified = await verifyWidgetToken(accessToken);
  if (!verified.ok) {
    const status = verified.code === WIDGET_CONFIGURATION_ERROR ? 503 : verified.code === WIDGET_TOKEN_INVALID ? 400 : 502;
    return fail(verified.error ?? "Token verification failed.", status, verified.code);
  }

  const phone = normalizeIndianMobile(verified.phone);
  if (!phone) return fail("Invalid mobile number from provider.", 422);

  try {
    // Find existing student or create new one (link to user)
    const existing = await db.student.findFirst({ where: { phone }, include: { user: true } });
    if (existing?.user && existing.user.role === "STUDENT") {
      if (!existing.user.isActive) return fail("This account is deactivated. Contact the academy office.", 403);
      const token = createSessionToken({ id: existing.user.id, email: existing.user.email, name: existing.user.name, role: "STUDENT" });
      if (!token) return fail("Login needs SESSION_SECRET.", 503);
      const res = ok({
        user: sanitizeUser({ id: existing.user.id, name: existing.user.name, email: existing.user.email, role: existing.user.role }),
        student: { id: existing.id, studentId: existing.studentId, name: existing.name, batchId: existing.batchId, courseId: existing.courseId },
      });
      res.headers.set("Set-Cookie", sessionCookieHeader(token));
      return res;
    }

    // Create new student account if not exists
    // This mirrors the registration flow but without password (widget-verified mobile only)
    // Note: widget flow assumes mobile is the primary credential; email/password can be added later via profile
    const baseName = `Student ${phone.slice(-4)}`;
    const userCount = await db.user.count({ where: { phone } });
    const name = userCount > 0 ? `${baseName} ${userCount + 1}` : baseName;

    const user = await db.user.create({
      data: {
        name,
        email: `${phone.replace(/\D/g, "")}@widget.local`, // placeholder; user can set real email later
        phone,
        passwordHash: await (await import("@/lib/credentials")).unusablePasswordHash(),
        role: "STUDENT",
        isActive: true,
      },
    });

    // Generate unique studentId
    const year = new Date().getFullYear();
    let sid = `NA-${year}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    for (let i = 0; i < 5; i++) {
      if (!(await db.student.findUnique({ where: { studentId: sid }, select: { id: true } }))) break;
      sid = `NA-${year}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    }

    const student = await db.student.create({
      data: {
        userId: user.id,
        studentId: sid,
        name,
        email: user.email,
        phone,
        status: "ACTIVE",
      },
    });

    const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: "STUDENT" });
    if (!token) return fail("Login needs SESSION_SECRET.", 503);

    const res = ok({
      user: sanitizeUser({ id: user.id, name: user.name, email: user.email, role: user.role }),
      student: { id: student.id, studentId: student.studentId, name: student.name, batchId: student.batchId, courseId: student.courseId },
    });
    res.headers.set("Set-Cookie", sessionCookieHeader(token));
    return res;
  } catch (err) {
    return serverError("auth:widget-verify", err);
  }
}