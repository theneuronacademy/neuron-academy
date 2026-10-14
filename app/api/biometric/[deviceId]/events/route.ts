// Biometric event ingestion (canonical JSON contract).
// POST /api/biometric/[deviceId]/events — device/bridge event intake.
// GET  /api/biometric/[deviceId]/events — ADMIN-only recent-event history.
//
// Canonical body: { biometricUserId, eventType, eventTimestamp? }.
// Raw ADMS wire pushes (TAB-separated ATTLOG over /iclock/*) do NOT belong
// here — they are accepted at /api/biometric/adms (or via the adms-bridge
// forwarder) and translated into this contract. Non-JSON posts here get an
// honest 422 pointing at the ADMS endpoint instead of a bare 400.
//
// Security: devices authenticate with `Authorization: Bearer <secret>`
// compared (constant-time) against BiometricDevice.authSecretHash. Devices
// with no provisioned secret are accepted in LEGACY mode and the response
// flags it — provision a secret to close the gap (DEVICE_AUTH_GAP).
// This endpoint intentionally takes NO session cookie: devices hold no
// user session. GET (history) is ADMIN-only via the session.
//
// Punch semantics live in lib/biometric-ingest.ts (shared with the ADMS
// receiver) so the two entries can never disagree.

import { NextRequest } from "next/server";
import { fail, ok, dbNotConfigured } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import {
  extractBearer,
  parseCanonicalBody,
  verifyDeviceSecret,
} from "@/lib/adms";
import { noteDeviceError, processBiometricPunch } from "@/lib/biometric-ingest";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET — ADMIN-only recent-event history (device secrets never selected).
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Loading device events");

  const { deviceId } = await params;
  const device = await db.biometricDevice.findUnique({ where: { id: deviceId } });
  if (!device) return fail(`Unknown biometric device ID "${deviceId}".`, 404);

  const events = await db.biometricDeviceEvent.findMany({
    where: { deviceId: device.id },
    orderBy: { eventTimestamp: "desc" },
    take: 50,
    select: {
      id: true,
      biometricUserId: true,
      eventTimestamp: true,
      eventType: true,
      processed: true,
      attendanceId: true,
      receivedAt: true,
    },
  });

  return ok({ events });
}

// ---------------------------------------------------------------------------
// POST — canonical device/bridge intake (bearer secret, no session cookie).
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const db = getDb();
  if (!db) return dbNotConfigured("Processing biometric event");

  const { deviceId } = await params;
  const device = await db.biometricDevice.findUnique({ where: { id: deviceId } });
  if (!device) return fail(`Unknown biometric device ID "${deviceId}".`, 404);
  if (!device.isActive) return fail(`Device "${device.name}" is inactive.`, 403);

  // Device authentication (constant-time). Legacy mode when unprovisioned.
  const secretCheck = verifyDeviceSecret(extractBearer(req), device.authSecretHash ?? null);
  if (!secretCheck.ok) {
    await noteDeviceError(db, device.id, "Rejected event: invalid device secret (401).");
    return fail("Invalid device credentials.", 401, "DEVICE_UNAUTHORIZED");
  }

  // Canonical JSON only — raw ADMS wire belongs at /api/biometric/adms.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return fail(
      "This endpoint accepts canonical JSON only. Raw ADMS pushes belong at /api/biometric/adms (or via adms-bridge).",
      422,
      "ADMS_USE_DEDICATED_ENDPOINT"
    );
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const parsed = parseCanonicalBody(raw);
  if (!parsed.ok) return fail(parsed.error, 400);

  const result = await processBiometricPunch(db, device, {
    biometricUserId: parsed.event.biometricUserId,
    eventType: parsed.event.eventType,
    eventTimestamp: parsed.event.eventTimestamp,
    extra: parsed.event.extra,
  });

  const legacyAuth = secretCheck.legacy;
  switch (result.outcome) {
    case "heartbeat":
      return ok({ heartbeat: true, deviceLastSeenAt: new Date(), legacyAuth, message: "Heartbeat recorded." });
    case "duplicate":
      return ok({
        duplicate: true,
        attendance: result.attendance,
        legacyAuth,
        message: result.attendance
          ? "Event already processed — delivery idempotent."
          : "Event record already exists but attendance was not created (unmapped user).",
      });
    case "unknown-user":
    case "batchless":
      return fail(result.reason, 409);
    case "non-student":
      return ok({
        duplicate: false,
        attendance: null,
        legacyAuth,
        message: `Presence logged for ${result.userType} record "${result.name}" — student attendance not applicable.`,
      });
    case "failed":
      return fail(result.reason, 500);
    case "ingested":
      return ok({
        duplicate: false,
        attendance: result.attendance,
        viaMapping: result.viaMapping,
        legacyAuth,
        eventType: parsed.event.eventType,
        eventTimestamp: parsed.event.eventTimestamp.toISOString(),
        message: "Biometric event processed successfully.",
      });
  }
}
