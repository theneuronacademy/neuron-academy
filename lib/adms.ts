// Biometric ADMS protocol helpers — SERVER-SIDE ONLY (never import from
// client components; secrets are compared here).
//
// Wire basis: the iClock/ADMS PUSH family, the de-facto standard for
// ZKTeco-platform terminals (eSSL K90 Pro: Push Data = Yes, TCP/IP):
//   GET  /iclock/cdata[aspx]?SN=<serial>            — registration/handshake
//   POST /iclock/cdata[aspx]?SN=..&table=ATTLOG     — attendance push,
//        body = one tab-separated punch per line:
//        PIN<TAB>DateTime<TAB>Status<TAB>Verify<TAB>WorkCode...
//        e.g. "1042\t2026-10-14 09:05:00\t0\t1\t0"
//   GET  /iclock/getrequest[aspx]                    — command poll (reply OK)
//   GET  /iclock/devicecmd[aspx]                     — command result (reply OK)
// Status: 0 = check-in, 1 = check-out (2-5 = break/OT variants).
//
// HONESTY CONTRACT: the above is community-documented behavior for the
// protocol family, NOT a confirmed capture of this site's K90 Pro firmware
// (Ver 8.0.4.3 / Push 2.0.33S). The parser below is intentionally tolerant
// (both path spellings, tab-or-whitespace fields, several timestamp forms)
// so firmware variants ingest instead of 400ing. Claiming HARDWARE-VERIFIED
// still requires one live capture — see ADMS-CAPTURE-README.md.

import crypto from "crypto";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Time handling
// ---------------------------------------------------------------------------

/** Device-local naive timestamps are interpreted as IST (UTC+5:30). */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** Accept `YYYY-MM-DD HH:MM:SS`, `YYYY/MM/DD HH:MM:SS`, ISO-8601, epoch s/ms. */
export function parseAdmsTimestamp(raw: unknown): Date | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw; // epoch seconds vs millis
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  // Explicit zone/offset or ISO with T: honor as-is.
  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s) || /T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
  );
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d, h, mi, sec] = m.map(Number);
  const utcMs =
    Date.UTC(y, mo - 1, d, h, mi, sec || 0) - IST_OFFSET_MINUTES * 60 * 1000;
  const out = new Date(utcMs);
  return Number.isNaN(out.getTime()) ? null : out;
}

/** Punch timestamps more than this far in the future are rejected (clock drift). */
export const MAX_FUTURE_DRIFT_MS = 24 * 60 * 60 * 1000;

export function isExcessiveFutureDrift(d: Date, nowMs = Date.now()): boolean {
  return d.getTime() - nowMs > MAX_FUTURE_DRIFT_MS;
}

// ---------------------------------------------------------------------------
// ATTLOG body parsing
// ---------------------------------------------------------------------------

export interface AdmsPunch {
  pin: string;
  timestamp: Date;
  status: number;
  verify: number;
  workCode: string;
}

export interface AttLogParseResult {
  punches: AdmsPunch[];
  skipped: number;
}

/** Parse a POSTed ATTLOG body: one punch per line, TAB-separated fields. */
export function parseAttLogBody(body: string): AttLogParseResult {
  const punches: AdmsPunch[] = [];
  let skipped = 0;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const fields =
      line.split("\t").length >= 2 ? line.split("\t") : line.split(/\s{2,}|\s/);
    const pin = (fields[0] ?? "").trim();
    const timestamp = parseAdmsTimestamp((fields[1] ?? "").trim());
    if (!pin || !timestamp) {
      skipped += 1;
      continue;
    }
    const status = Number.parseInt((fields[2] ?? "0").trim(), 10);
    const verify = Number.parseInt((fields[3] ?? "").trim(), 10);
    punches.push({
      pin,
      timestamp,
      status: Number.isFinite(status) ? status : 0,
      verify: Number.isFinite(verify) ? verify : -1,
      workCode: (fields[4] ?? "").trim(),
    });
  }
  return { punches, skipped };
}

/** ADMS punch status → Neuron Academy attendance status. */
export function mapAttStatus(status: number): "PRESENT" | "LEAVE" {
  // 0 = check-in ... 1 = check-out. Break/OT variants (2-5) count as present.
  return status === 1 ? "LEAVE" : "PRESENT";
}

// ---------------------------------------------------------------------------
// Handshake / poll responses
// ---------------------------------------------------------------------------

/** Options block answering GET /iclock/cdata registration. */
export function buildRegistrationResponse(serial: string): string {
  return [
    `GET OPTION FROM: ${serial}`,
    "ATTLOGStamp=None",
    "OPERLOGStamp=None",
    "ATTPHOTOStamp=None",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=TransData AttLog",
    "Realtime=1",
    "Encrypt=None",
    "TimeZone=330",
    "ServerVer=1.0 NeuronAcademy-ADMS",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Heartbeats + canonical JSON
// ---------------------------------------------------------------------------

const HEARTBEAT_TYPES = new Set([
  "HEARTBEAT",
  "PING",
  "REG",
  "REGISTER",
  "HELLO",
  "ONLINE",
]);

export function isHeartbeatEventType(t: string): boolean {
  return HEARTBEAT_TYPES.has(t.trim().toUpperCase());
}

export interface CanonicalEvent {
  biometricUserId: string;
  eventType: string;
  eventTimestamp: Date;
  extra: Record<string, unknown>;
}

/** Validate the canonical JSON event body shared by bridge + integrations. */
export function parseCanonicalBody(body: unknown):
  | { ok: true; event: CanonicalEvent }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const biometricUserId =
    typeof b.biometricUserId === "string" ? b.biometricUserId.trim() : "";
  const eventType = typeof b.eventType === "string" ? b.eventType.trim() : "";
  if (!biometricUserId) return { ok: false, error: "biometricUserId must not be empty." };
  if (!eventType) return { ok: false, error: "eventType must not be empty." };
  const eventTimestamp =
    b.eventTimestamp === undefined
      ? new Date()
      : parseAdmsTimestamp(b.eventTimestamp);
  if (!eventTimestamp) return { ok: false, error: "Invalid eventTimestamp." };
  if (isExcessiveFutureDrift(eventTimestamp)) {
    return { ok: false, error: "eventTimestamp is too far in the future (clock drift?)." };
  }
  const extra: Record<string, unknown> = { ...b };
  delete extra.biometricUserId;
  delete extra.eventType;
  delete extra.eventTimestamp;
  return { ok: true, event: { biometricUserId, eventType, eventTimestamp, extra } };
}

/** Deterministic SHA-256 idempotency hash over the normalized event. */
export function computePayloadHash(
  biometricUserId: string,
  eventType: string,
  eventTimeMs: number,
  extra: Record<string, unknown>
): string {
  const normalized = { biometricUserId, eventType, eventTimestamp: eventTimeMs, ...extra };
  const payloadString = JSON.stringify(normalized, Object.keys(normalized).sort());
  return crypto.createHash("sha256").update(payloadString).digest("hex");
}

// ---------------------------------------------------------------------------
// Device shared-secret auth
// ---------------------------------------------------------------------------

/** One-time provisioning secret (shown once, never stored). */
export function generateDeviceSecret(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** SHA-256 hex stored in BiometricDevice.authSecretHash. */
export function hashDeviceSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

export function extractBearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Compare a presented secret against the stored hash.
 * Devices with NO stored hash operate in legacy mode (accepted, flagged).
 */
export function verifyDeviceSecret(
  presented: string | null,
  storedHash: string | null
): { ok: boolean; legacy: boolean } {
  if (!storedHash) return { ok: true, legacy: true };
  if (!presented) return { ok: false, legacy: false };
  const a = Buffer.from(hashDeviceSecret(presented), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return { ok: false, legacy: false };
  return { ok: crypto.timingSafeEqual(a, b), legacy: false };
}

/** Best-effort source IP (first X-Forwarded-For hop, else socket address). */
export function requestSourceIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return null;
}
