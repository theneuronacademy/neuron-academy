// Change admin password (ADMIN only, authenticated).
// POST /api/auth/admin/change-password
// Body: { currentPassword, newPassword }
// Verifies current password via bcrypt, hashes new password, updates DB.

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "ADMIN") return fail("Forbidden.", 403);

  const db = getDb();
  if (!db) return fail("Password change needs a database.", 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) return fail("Current password is required.", 400);
  if (!newPassword) return fail("New password is required.", 400);
  if (newPassword.length < 6) return fail("New password must be at least 6 characters.", 400);

  try {
    const user = await db.user.findUnique({ where: { id: viewer.id } });
    if (!user) return fail("Admin account not found.", 404);

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return fail("Current password is incorrect.", 401);

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.user.update({ where: { id: viewer.id }, data: { passwordHash: newHash } });

    return ok({ message: "Password changed successfully." });
  } catch (err) {
    return serverError("auth:change-password", err);
  }
}
