// Phase 21 — Student 2FA Setup
// Generate TOTP secret + QR code data for authenticator app

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { resolveStudent } from "@/lib/testAccess";
import { generateTotpSecret, generateBackupCodes, generateTotpUri } from "@/lib/totp";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("2FA setup");

  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile) return fail("Student profile not found.", 403);

    const user = await db.user.findUnique({ where: { id: auth.user.id } });
    if (!user) return fail("User not found.", 404);

    if (user.totpEnabled) {
      return fail("2FA is already enabled. Disable it first to reconfigure.", 400);
    }

    // Generate new secret and backup codes
    const secret = generateTotpSecret();
    const backupCodes = generateBackupCodes(8, 8);
    const otpauthUri = generateTotpUri(secret, user.email, "Neuron Academy");

    // Store secret temporarily (not enabled until verified)
    await db.user.update({
      where: { id: user.id },
      data: {
        totpSecret: secret,
        backupCodes: backupCodes,
      },
    });

    return ok({
      secret,
      backupCodes,
      otpauthUri,
      message: "Scan the QR code in your authenticator app, then verify with a 6-digit code.",
    });
  } catch (err) {
    return serverError("auth:2fa-setup", err);
  }
}