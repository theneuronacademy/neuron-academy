// Phase 12A — Biometric Device detail API (GET/PATCH/DELETE /api/biometric/devices/[id]).
// Admin-only. Handlers live here (not in devices/route.ts) because params require a dynamic segment.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const SUPPORTED_PROTOCOLS = ["ADMS"] as const;

const DEVICE_SELECT = {
  id: true,
  name: true,
  serialNumber: true,
  deviceType: true,
  protocol: true,
  ipAddress: true,
  port: true,
  location: true,
  isActive: true,
  lastSeenAt: true,
  totalEvents: true,
  failedEvents: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading biometric device");
  const { id } = await params;
  try {
    const device = await db.biometricDevice.findUnique({ where: { id }, select: DEVICE_SELECT });
    if (!device) return fail(`Biometric device with id "${id}" not found.`, 404);
    return ok({ device });
  } catch (err) {
    return serverError("biometric:device:get", err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating biometric device");
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const update: Record<string, unknown> = {};
  if ("name" in body && String(body.name) !== "") update.name = String(body.name);
  if ("location" in body) update.location = String(body.location);
  if ("isActive" in body) update.isActive = body.isActive === false ? false : true;
  // Phase 17 — invalid protocol/IP/port values are rejected (400), never
  // silently dropped: the admin must know the write did not apply.
  if ("protocol" in body) {
    const protocol = String(body.protocol);
    if (!SUPPORTED_PROTOCOLS.includes(protocol as (typeof SUPPORTED_PROTOCOLS)[number])) {
      return fail(`protocol must be one of: ${SUPPORTED_PROTOCOLS.join(", ")}.`, 400);
    }
    update.protocol = protocol;
  }
  if ("ipAddress" in body) {
    const ip = String(body.ipAddress);
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return fail("ipAddress must be a valid IPv4 address.", 400);
    }
    update.ipAddress = ip;
  }
  if ("port" in body) {
    const p = Number(body.port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      return fail("port must be an integer between 1 and 65535.", 400);
    }
    update.port = p;
  }
  if (Object.keys(update).length === 0) {
    return fail("No valid update fields provided.", 400);
  }
  try {
    const device = await db.biometricDevice.update({ where: { id }, data: update, select: DEVICE_SELECT });
    return ok({ item: device });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = err as any;
    if (error.code === "P2025") {
      return fail(`Biometric device with id "${id}" not found.`, 404);
    }
    if (error.code === "P2002") {
      return fail("A device with that serialNumber already exists.", 409);
    }
    return serverError("biometric:device:update", err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deactivating biometric device");
  const { id } = await params;
  try {
    // Phase 17 — allow-listed columns only (never leak device secrets).
    const device = await db.biometricDevice.delete({ where: { id }, select: DEVICE_SELECT });
    return ok({ item: device });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = err as any;
    if (error.code === "P2025") {
      return fail(`Biometric device with id "${id}" not found.`, 404);
    }
    try {
      await db.biometricDevice.update({ where: { id }, data: { isActive: false } });
      return ok({ item: { id, deactivated: true, message: "Device deactivated due to event record dependencies." } });
    } catch (err2) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error2 = err2 as any;
      return serverError("biometric:device:delete", error2);
    }
  }
}
