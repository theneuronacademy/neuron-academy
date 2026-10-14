// Single biometric mapping — ADMIN-only.
// PATCH  /api/biometric/devices/[id]/mappings/[mappingId] — { isActive?, userKey? }.
// DELETE /api/biometric/devices/[id]/mappings/[mappingId] — remove binding.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { resolveMappingTarget } from "@/lib/biometric-ingest";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma delegate passthrough; keeps the route compiling against generated types.
async function loadOwned(db: any, deviceId: string, mappingId: string) {
  return db.biometricUserMap.findFirst({ where: { id: mappingId, deviceId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mappingId: string }> }
) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating biometric mapping");
  const { id, mappingId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const existing = await loadOwned(db, id, mappingId);
    if (!existing) return fail("Mapping not found on this device.", 404);

    const update: Record<string, unknown> = {};
    if ("isActive" in body) update.isActive = body.isActive === true;
    if (typeof body.userKey === "string" && body.userKey.trim()) {
      const current = await db.biometricUserMap.findUnique({
        where: { id: mappingId },
        select: { userType: true },
      });
      const target = await resolveMappingTarget(
        db,
        (current?.userType ?? "STUDENT") as "STUDENT" | "FACULTY",
        body.userKey
      );
      if (!target.ok) return fail(target.error, 404);
      update.userId = target.userId;
    }
    if (Object.keys(update).length === 0) return fail("No valid update fields provided.", 400);

    const item = await db.biometricUserMap.update({ where: { id: mappingId }, data: update });
    return ok({ item });
  } catch (err) {
    return serverError("biometric:mapping:update", err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mappingId: string }> }
) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting biometric mapping");
  const { id, mappingId } = await params;
  try {
    const existing = await loadOwned(db, id, mappingId);
    if (!existing) return fail("Mapping not found on this device.", 404);
    await db.biometricUserMap.delete({ where: { id: mappingId } });
    return ok({ item: { id: mappingId, deleted: true } });
  } catch (err) {
    return serverError("biometric:mapping:delete", err);
  }
}
