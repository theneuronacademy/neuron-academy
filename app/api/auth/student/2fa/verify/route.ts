// Phase 21 — Student 2FA Verify
// Verify TOTP code during setup or login

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { verifyTotp } from "@/lib/totp";
import { createSessionToken, isAuthConfigured, sessionCookieHeader } from "@/lib/session";
import { sanitizeUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("2FA verify");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const isSetup = body.setup === true;

  if (!token || !/^\d{6}$/.test(token)) {
    return fail("Enter a valid 6-digit code.", 400);
  }

  try {
    if (isSetup) {
      // Setup flow: verify with session user
      const auth = requireApiRole(req, ["STUDENT"]);
      if (!auth.ok) return fail(auth.error, auth.status);

      const user = await db.user.findUnique({ where: { id: auth.user.id } });
      if (!user || !user.totpSecret) {
        return fail("No pending 2FA setup found.", 400);
      }

      if (!verifyTotp(user.totpSecret, token)) {
        return fail("Invalid code. Check your authenticator app.", 400);
      }

      // Enable 2FA
      await db.user.update({
        where: { id: user.id },
        data: { totpEnabled: true },
      });

      return ok({ enabled: true, message: "2FA enabled successfully." });
    } else {
      // Login flow: verify with mobile + password first, then TOTP
      const phone = typeof body.phone === "string" ? body.phone : "";
      const password = typeof body.password === "string" ? body.password : "";
      const backupCode = typeof body.backupCode === "string" ? body.backupCode.trim().toUpperCase() : "";

      if (!phone || !password) {
        return fail("Mobile and password required for login.", 400);
      }

      const { normalizePhone, verifyPassword } = await import("@/lib/credentials");
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) return fail("Invalid mobile number.", 400);

      const student = await db.student.findFirst({ where: { phone: normalizedPhone }, include: { user: true } });
      const user = student?.user;
      if (!student || !user || user.role !== "STUDENT") return fail("Invalid mobile number or password.", 401);
      if (!(await verifyPassword(password, user.passwordHash))) return fail("Invalid mobile number or password.", 401);
      if (!user.isActive) return fail("This account is deactivated.", 403);
      if (!user.totpEnabled) return fail("2FA not enabled for this account.", 400);

      let verified = false;
      let consumedBackup = false;

      if (backupCode) {
        // Verify backup code
        const { verifyAndConsumeBackupCode } = await import("@/lib/totp");
        const result = verifyAndConsumeBackupCode(user.backupCodes ?? [], backupCode);
        if (result.valid) {
          verified = true;
          consumedBackup = true;
          await db.user.update({ where: { id: user.id }, data: { backupCodes: result.remaining } });
        }
      } else {
        // Verify TOTP
        if (!user.totpSecret || !verifyTotp(user.totpSecret, token)) {
          return fail("Invalid code or backup code.", 401);
        }
        verified = true;
      }

      if (!verified) return fail("Invalid code or backup code.", 401);

      // Create session
      if (!isAuthConfigured()) return fail("Login needs SESSION_SECRET.", 503);
      const sessionToken = createSessionToken({ id: user.id, email: user.email, name: user.name, role: "STUDENT" });
      if (!sessionToken) return fail("Login needs SESSION_SECRET.", 503);

      const res = ok({
        user: sanitizeUser({ id: user.id, name: user.name, email: user.email, role: user.role }),
        student: { id: student.id, studentId: student.studentId, name: student.name, batchId: student.batchId, courseId: student.courseId },
        consumedBackup,
      });
      res.headers.set("Set-Cookie", sessionCookieHeader(sessionToken));
      return res;
    }
  } catch (err) {
    return serverError("auth:2fa-verify", err);
  }
}