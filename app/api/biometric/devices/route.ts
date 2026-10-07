// Phase 12A — Biometric Device Management API
// Admin-only endpoints for X2000 device registration and status.
// Device credentials are stored server-side only; never exposed to frontend.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

const SUPPORTED_PROTOCOLS = ["ADMS"] as const;

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Listing biometric devices");
  try {
    const devices = await db.biometricDevice.findMany({
      orderBy: { lastSeenAt: "desc" },
      select: {
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
      },
    });
    return ok({ devices });
  } catch (err) {
    return serverError("biometric:devices:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating biometric device");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["name", "serialNumber"]);
  if (missing.length > 0) {
    return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  }
  // Validate protocol
  const protocol = String(body.protocol ?? "ADMS");
  if (!SUPPORTED_PROTOCOLS.includes(protocol as (typeof SUPPORTED_PROTOCOLS)[number])) {
    return fail(`Unsupported protocol. Supported: ${SUPPORTED_PROTOCOLS.join(", ")}.`, 400);
  }
  // Validate IP format (basic check)
  const ipAddress = String(body.ipAddress ?? "");
  if (ipAddress && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ipAddress)) {
    return fail("Invalid IP address format.", 400);
  }
  // Validate port if provided
  const port = Number(body.port);
  if (body.port !== undefined && (Number.isNaN(port) || port < 1 || port > 65535)) {
    return fail("Port must be between 1 and 65535.", 400);
  }
  try {
    const device = await db.biometricDevice.create({
      data: {
        name: String(body.name),
        serialNumber: String(body.serialNumber),
        deviceType: body.deviceType ?? "X2000",
        ipAddress: ipAddress || undefined,
        port: body.port ?? undefined,
        protocol,
        location: String(body.location ?? ""),
        isActive: body.isActive !== false, // default true
      },
      select: {
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
      },
    });
    return ok({ item: device }, 201);
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = err as any;
    if (error.code === "P2002") {
      // Unique constraint on serialNumber
      return fail(`A device with serialNumber "${String(body.serialNumber)}" already exists.`, 409);
    }
    return serverError("biometric:device:create", err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating biometric device");
  const { id } = params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  // Build update data — only allow safe fields
  const update: Record<string, unknown> = {};
  if ("name" in body && String(body.name) !== "") update.name = String(body.name);
  if ("location" in body) update.location = String(body.location);
  if ("isActive" in body) update.isActive = body.isActive === false ? false : true;
  if ("protocol" in body) {
    const protocol = String(body.protocol);
    if (SUPPORTED_PROTOCOLS.includes(protocol as (typeof SUPPORTED_PROTOCOLS)[number])) {
      update.protocol = protocol;
    }
  }
  if ("ipAddress" in body) {
    const ip = String(body.ipAddress);
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) update.ipAddress = ip;
  }
  if ("port" in body) {
    const p = Number(body.port);
    if (!Number.isNaN(p) && p >= 1 && p <= 65535) update.port = p;
  }
  if (Object.keys(update).length === 0) {
    return fail("No valid update fields provided.", 400);
  }
  try {
    const device = await db.biometricDevice.update({
      where: { id },
      data: update,
      select: {
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
      },
    });
    return ok({ item: device });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = err as any;
    if (error.code === "P2025") {
      return fail(`A device with that serialNumber already exists.`, 409);
    }
    return serverError("biometric:device:update", err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deactivating biometric device");
  const { id } = params;
  // Prefer deactivation over deletion to preserve historical BiometricDeviceEvent records.
  // If deletion is absolutely required, the schema relationship would need to be re-evaluated.
  try {
    const device = await db.biometricDevice.delete({ where: { id } });
    return ok({ item: device });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = err as any;
    if (error.code === "P2025") {
      return fail(`Biometric device with id "${id}" not found.`, 404);
    }
    // If foreign key constraint prevents deletion, deactivate instead
    try {
      await db.biometricDevice.update({
        where: { id },
        data: { isActive: false },
      });
      return ok({ item: { id, deactivated: true, message: "Device deactivated due to event record dependencies." } });
    } catch (err2) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error2 = err2 as any;
    return serverError("biometric:device:delete", error2);
    }
  }
}