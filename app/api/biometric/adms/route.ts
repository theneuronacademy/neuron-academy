// Raw ADMS wire receiver (iClock PUSH family).
// Serves device-initiated traffic directly AND behind the /iclock/* rewrite
// (see next.config.mjs):
//   GET  /iclock/cdata?SN=<serial>                  — registration/handshake
//   POST /iclock/cdata?SN=<serial>&table=ATTLOG     — attendance push
//   GET  /iclock/getrequest                         — command poll (reply OK)
//   GET  /iclock/devicecmd                          — command result (reply OK)
//
// Device identity = SN query param → BiometricDevice.serialNumber.
// Optional IP allowlist: when the device row has ipAddress set, pushes from
// any other source IP are rejected (401). Unset = no restriction.
// No session cookie is involved; devices authenticate by network identity
// (SN + optional allowlist). The per-device bearer secret applies to the
// canonical JSON endpoint and the adms-bridge forwarder, which is the
// RECOMMENDED production path (plain-HTTP :8787 listener + forwarding).
//
// Protocol replies are plain text ("OK" / options block) — devices do not
// speak JSON. Batch punches are processed INDEPENDENTLY: per-punch domain
// outcomes (unknown user, batchless) are counted, never fail the batch,
// and the reply stays "OK" so the device does not retry-storm. Retried
// deliveries are idempotent via payloadHash (shared pipeline).

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import {
  buildRegistrationResponse,
  parseAttLogBody,
  requestSourceIp,
} from "@/lib/adms";
import {
  noteDeviceError,
  processBiometricPunch,
  touchDeviceSeen,
} from "@/lib/biometric-ingest";

export const dynamic = "force-dynamic";

function text(body: string, status = 200): NextResponse {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function noDatabase(): NextResponse {
  // Fail CLOSED but device-friendly: plain-text error, device will retry.
  return text("SERVER NOT READY", 503);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const db = getDb();
  if (!db) return noDatabase();
  const q = new URL(req.url).searchParams;
  const serial = (q.get("SN") ?? q.get("sn") ?? "").trim();
  const sub = (q.get("admsPath") ?? "").toLowerCase();
  if (!serial) return text("MISSING SN", 400);

  const device = await db.biometricDevice.findUnique({ where: { serialNumber: serial } });
  if (!device) return text("UNKNOWN DEVICE", 404);
  if (!device.isActive) return text("DEVICE DISABLED", 403);

  // Command poll / heartbeat / result endpoints: nothing queued server-side.
  if (sub === "getrequest" || sub === "devicecmd" || sub === "ping") {
    await touchDeviceSeen(db, device.id, new Date(), { heartbeat: true, countEvent: false });
    return text("OK");
  }

  // Registration handshake.
  await touchDeviceSeen(db, device.id, new Date(), { heartbeat: true, countEvent: false });
  return text(buildRegistrationResponse(serial));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const db = getDb();
  if (!db) return noDatabase();
  const q = new URL(req.url).searchParams;
  const serial = (q.get("SN") ?? q.get("sn") ?? "").trim();
  const table = (q.get("table") ?? "").toUpperCase();
  const sub = (q.get("admsPath") ?? "").toLowerCase();
  if (!serial) return text("MISSING SN", 400);

  const device = await db.biometricDevice.findUnique({ where: { serialNumber: serial } });
  if (!device) return text("UNKNOWN DEVICE", 404);
  if (!device.isActive) return text("DEVICE DISABLED", 403);

  // IP allowlist enforcement (only when determinable; otherwise accept and note).
  if (device.ipAddress) {
    const src = requestSourceIp(req);
    if (src && src !== device.ipAddress) {
      await noteDeviceError(db, device.id, `Rejected ADMS push from non-allowlisted IP ${src}.`);
      return text("UNAUTHORIZED", 401);
    }
    if (!src) {
      await noteDeviceError(
        db,
        device.id,
        "Source IP unverifiable for this request; allowlist not enforced."
      );
    }
  }

  // Command results carry no attendance.
  if (sub === "devicecmd" || table === "DEVICE_CMD" || table === "OPERLOG") {
    await touchDeviceSeen(db, device.id, new Date(), { heartbeat: true, countEvent: false });
    return text("OK");
  }

  if (table !== "" && table !== "ATTLOG") {
    return text("UNSUPPORTED TABLE", 422);
  }

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return text("BAD BODY", 400);
  }
  if (rawBody.length > 1_000_000) return text("BODY TOO LARGE", 413);

  const { punches, skipped } = parseAttLogBody(rawBody);
  let ingested = 0;
  let duplicates = 0;
  let unmapped = 0;
  for (const p of punches) {
    try {
      const result = await processBiometricPunch(db, device, {
        biometricUserId: p.pin,
        eventType: String(p.status),
        eventTimestamp: p.timestamp,
        extra: { admsVerify: p.verify, admsWorkCode: p.workCode },
        admsStatus: p.status,
      });
      if (result.outcome === "ingested") ingested += 1;
      else if (result.outcome === "duplicate") duplicates += 1;
      else unmapped += 1; // unknown-user / batchless / non-student / failed
    } catch {
      unmapped += 1;
    }
  }
  if (skipped > 0 || unmapped > 0) {
    await noteDeviceError(
      db,
      device.id,
      `ATTLOG batch: ${ingested} ingested, ${duplicates} duplicates, ${unmapped} unmapped, ${skipped} malformed lines.`
    );
  } else {
    await touchDeviceSeen(db, device.id, new Date(), {});
  }
  // Always OK: the device retries anything else, and retries are idempotent.
  return text("OK");
}
