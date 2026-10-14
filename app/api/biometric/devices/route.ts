// Phase 12A — Biometric Device Management API
// Admin-only endpoints for X2000 device registration and status.
// Device credentials are stored server-side only; never exposed to frontend.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { generateDeviceSecret, hashDeviceSecret } from "@/lib/adms";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

const SUPPORTED_PROTOCOLS = ["ADMS"] as const;

// Allow-listed read columns — authSecretHash is NEVER selected or returned.
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
  lastHeartbeatAt: true,
  lastError: true,
  totalEvents: true,
  failedEvents: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Listing biometric devices");
  try {
    const devices = await db.biometricDevice.findMany({
      orderBy: { lastSeenAt: "desc" },
      select: { ...DEVICE_SELECT },
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
    // Optional shared-secret provisioning. The plaintext secret is returned
    // ONCE in this 201 response — it is stored hashed and never readable again.
    // Omit both fields to keep the device in legacy (unprovisioned) mode.
    let provisionedSecret: string | null = null;
    let authSecretHash: string | undefined;
    if (body.provisionSecret === true) {
      provisionedSecret = generateDeviceSecret();
      authSecretHash = hashDeviceSecret(provisionedSecret);
    } else if (typeof body.authSecret === "string" && body.authSecret) {
      if (body.authSecret.length < 16) {
        return fail("authSecret must be at least 16 characters.", 400);
      }
      provisionedSecret = body.authSecret;
      authSecretHash = hashDeviceSecret(provisionedSecret);
    }
    const device = await db.biometricDevice.create({
      data: {
        name: String(body.name),
        serialNumber: String(body.serialNumber),
        deviceType: typeof body.deviceType === "string" && body.deviceType ? String(body.deviceType) : "X2000",
        ipAddress: ipAddress || undefined,
        port: body.port === undefined ? undefined : port,
        protocol,
        location: String(body.location ?? ""),
        isActive: body.isActive !== false, // default true
        ...(authSecretHash ? { authSecretHash } : {}),
      },
      select: { ...DEVICE_SELECT },
    });
    return ok(
      {
        item: device,
        ...(provisionedSecret
          ? {
              provisionedSecret,
              secretWarning:
                "Copy this secret into the adms-bridge configuration NOW — it is never shown again.",
            }
          : { provisionedSecret: null }),
      },
      201
    );
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
