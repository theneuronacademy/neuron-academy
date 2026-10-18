// Phase 21 — Student 2FA Disable
// Disable 2FA after TOTP verification

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { resolveStudent } from "@/lib/testAccess";
import { verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("2FA disable");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || !/^\d{6}$/.test(token)) {
    return fail("Enter a valid 6-digit code from your authenticator app.", 400);
  }

  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile) return fail("Student profile not found.", 403);

    const user = await db.user.findUnique({ where: { id: auth.user.id } });
    const userWith2FA = user as { totpEnabled?: boolean; totpSecret?: string; backupCodes?: string[] };
    if (!user) return fail("User not found.", 404);
    if (!userWith2FA.totpEnabled) return fail("2FA is not enabled.", 400);
    if (!userWith2FA.totpSecret) return fail("2FA secret not found.", 400);

    if (!verifyTotp(userWith2FA.totpSecret, token)) {
      return fail("Invalid code. Check your authenticator app.", 400);
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: false,
        totpSecret: null,
        backupCodes: [],
      } as { totpEnabled: boolean; totpSecret: null; backupCodes: string[] },
    });

    return ok({ disabled: true, message: "2FA disabled successfully." });
  } catch (err) {
    return serverError("auth:2fa-disable", err);
  }
}