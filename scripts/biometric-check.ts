// Biometric integration regression checks.
// Run: npm run biometric:check
// No database, no network, no new packages. Pure unit tests over the REAL
// protocol helpers (lib/adms) with mocked device payloads, plus static
// route/schema/UI wiring assertions. Exits non-zero on failure.
//
// These are MOCKED-event tests: they prove the receiver logic handles valid
// punches, duplicates, invalid payloads, unknown IDs and unauthorized
// requests. They do NOT prove a physical K90 talks to this server — that
// needs one live capture (see ADMS-CAPTURE-README.md).

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildRegistrationResponse,
  computePayloadHash,
  extractBearer,
  generateDeviceSecret,
  hashDeviceSecret,
  isExcessiveFutureDrift,
  isHeartbeatEventType,
  mapAttStatus,
  parseAdmsTimestamp,
  parseAttLogBody,
  parseCanonicalBody,
  verifyDeviceSecret,
} from "../lib/adms";

const ROOT = process.cwd();

let pass = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    pass += 1;
  } else {
    failed += 1;
    console.error("FAIL: " + name);
  }
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

// ---------------------------------------------------------------------------
// 1. ATTLOG parsing — valid punches (mocked K90-style payload)
// ---------------------------------------------------------------------------
{
  const body = "1042\t2026-10-14 09:05:00\t0\t1\t0\n1043\t2026-10-14 09:06:12\t0\t1\t0\n";
  const r = parseAttLogBody(body);
  check("attlog parses 2 punches", r.punches.length === 2 && r.skipped === 0);
  check("attlog pin parsed", r.punches[0].pin === "1042");
  check("attlog status check-in", r.punches[0].status === 0);
  check("attlog IST->UTC conversion", r.punches[0].timestamp.toISOString() === "2026-10-14T03:35:00.000Z");
  check("attlog check-in maps PRESENT", mapAttStatus(r.punches[0].status) === "PRESENT");
}

// ---------------------------------------------------------------------------
// 2. ATTLOG — check-out + malformed lines
// ---------------------------------------------------------------------------
{
  const body = "1042\t2026-10-14 18:02:00\t1\t1\t0\nGARBAGE LINE\n\n\t\t\n";
  const r = parseAttLogBody(body);
  check("attlog checkout parsed", r.punches.length === 1);
  check("attlog checkout maps LEAVE", mapAttStatus(r.punches[0].status) === "LEAVE");
  check("attlog malformed skipped", r.skipped === 1);
}

// ---------------------------------------------------------------------------
// 3. Timestamps — ISO, epoch, invalid, future drift
// ---------------------------------------------------------------------------
{
  check("iso timestamp honored", parseAdmsTimestamp("2026-10-14T09:05:00Z")?.toISOString() === "2026-10-14T09:05:00.000Z");
  check("epoch seconds accepted", parseAdmsTimestamp(1760425500)?.getTime() === 1760425500000);
  check("epoch millis accepted", parseAdmsTimestamp(1760425500000)?.getTime() === 1760425500000);
  check("invalid timestamp null", parseAdmsTimestamp("not-a-date") === null);
  check("empty timestamp null", parseAdmsTimestamp("") === null);
  check(
    "future drift rejected",
    isExcessiveFutureDrift(new Date(Date.now() + 25 * 3600 * 1000)) === true
  );
  check(
    "same-day timestamp allowed",
    isExcessiveFutureDrift(new Date(Date.now() + 3600 * 1000)) === false
  );
}

// ---------------------------------------------------------------------------
// 4. Canonical JSON body validation
// ---------------------------------------------------------------------------
{
  const good = parseCanonicalBody({ biometricUserId: "1042", eventType: "CHECK_IN", eventTimestamp: "2026-10-14 09:05:00" });
  check("canonical valid accepted", good.ok === true);
  const def = parseCanonicalBody({ biometricUserId: "1042", eventType: "PING" });
  check("canonical missing timestamp defaults now", def.ok === true);
  check("canonical empty id rejected", parseCanonicalBody({ biometricUserId: " ", eventType: "X" }).ok === false);
  check("canonical empty type rejected", parseCanonicalBody({ biometricUserId: "1", eventType: "" }).ok === false);
  check("canonical non-object rejected", parseCanonicalBody("nope").ok === false);
  check("canonical future rejected", parseCanonicalBody({ biometricUserId: "1", eventType: "X", eventTimestamp: "2999-01-01 00:00:00" }).ok === false);
}

// ---------------------------------------------------------------------------
// 5. Heartbeats never create attendance (classified, not ingested)
// ---------------------------------------------------------------------------
{
  check("HEARTBEAT classified", isHeartbeatEventType("HEARTBEAT") === true);
  check("ping classified", isHeartbeatEventType("ping") === true);
  check("REG classified", isHeartbeatEventType("REG") === true);
  check("CHECK_IN not heartbeat", isHeartbeatEventType("CHECK_IN") === false);
  check("numeric status not heartbeat", isHeartbeatEventType("0") === false);
}

// ---------------------------------------------------------------------------
// 6. Device secret auth — unauthorized requests rejected, legacy flagged
// ---------------------------------------------------------------------------
{
  const secret = generateDeviceSecret();
  check("secret generated non-empty", secret.length >= 16);
  const stored = hashDeviceSecret(secret);
  check("secret hash is sha256 hex", /^[0-9a-f]{64}$/.test(stored));
  check("correct secret accepted", verifyDeviceSecret(secret, stored).ok === true);
  check("wrong secret rejected", verifyDeviceSecret("wrong-secret-value", stored).ok === false);
  check("missing secret rejected when provisioned", verifyDeviceSecret(null, stored).ok === false);
  const legacy = verifyDeviceSecret(null, null);
  check("unprovisioned device legacy-accepted", legacy.ok === true && legacy.legacy === true);
  const fakeReq = { headers: { get: (k: string) => (k === "authorization" ? "Bearer abc123" : null) } };
  check("bearer extracted", extractBearer(fakeReq as unknown as Parameters<typeof extractBearer>[0]) === "abc123");
}

// ---------------------------------------------------------------------------
// 7. Idempotency hash deterministic (duplicate-punch prevention basis)
// ---------------------------------------------------------------------------
{
  const a = computePayloadHash("1042", "CHECK_IN", 1760425500000, {});
  const b = computePayloadHash("1042", "CHECK_IN", 1760425500000, {});
  const c = computePayloadHash("1042", "CHECK_OUT", 1760425500000, {});
  check("payload hash deterministic", a === b);
  check("payload hash distinguishes events", a !== c);
}

// ---------------------------------------------------------------------------
// 8. Registration handshake response shape
// ---------------------------------------------------------------------------
{
  const r = buildRegistrationResponse("K90TEST123");
  check("handshake echoes serial", r.includes("GET OPTION FROM: K90TEST123"));
  check("handshake enables realtime", r.includes("Realtime=1"));
  check("handshake declares IST zone", r.includes("TimeZone=330"));
}

// ---------------------------------------------------------------------------
// 9. Schema — persistent mapping + auth/health fields (static)
// ---------------------------------------------------------------------------
{
  const schema = read("prisma/schema.prisma");
  check("schema has BiometricUserMap", schema.includes("model BiometricUserMap"));
  check("schema has BiometricUserType", schema.includes("enum BiometricUserType"));
  check("schema mapping unique per device", schema.includes("@@unique([deviceId, biometricUserId])"));
  check("schema device has mappings relation", schema.includes("mappings BiometricUserMap[]"));
  check("schema device has authSecretHash", schema.includes("authSecretHash"));
  check("schema device has lastHeartbeatAt", schema.includes("lastHeartbeatAt"));
  check("schema device has lastError", schema.includes("lastError"));
  check("schema attendance keeps BIOMETRIC source", schema.includes("BIOMETRIC"));
  check("schema attendance unique student+date", schema.includes("@@unique([studentId, date])"));
}

// ---------------------------------------------------------------------------
// 10. Migration authored, additive only (static, NOT applied here)
// ---------------------------------------------------------------------------
{
  const mig = "prisma/migrations/20261014000000_biometric_usermap_auth/migration.sql";
  check("migration file exists", existsSync(join(ROOT, mig)));
  const sql = read(mig);
  check("migration creates mapping table", sql.includes('CREATE TABLE "BiometricUserMap"'));
  check("migration adds secret column", sql.includes("authSecretHash"));
  check("migration adds heartbeat column", sql.includes("lastHeartbeatAt"));
  check("migration has FK cascade", sql.includes("ON DELETE CASCADE"));
  check("migration drops nothing", !sql.includes("DROP TABLE") && !sql.includes("DROP COLUMN"));
}

// ---------------------------------------------------------------------------
// 11. Canonical ingestion route — auth, mapping-first, guards (static)
// ---------------------------------------------------------------------------
{
  const route = read("app/api/biometric/[deviceId]/events/route.ts");
  check("canonical verifies bearer secret", route.includes("verifyDeviceSecret"));
  check("canonical rejects bad secret 401", route.includes("DEVICE_UNAUTHORIZED"));
  check("canonical GET is admin-only", route.includes('requireApiRole(req, ["ADMIN"])'));
  check("canonical uses shared pipeline", route.includes("processBiometricPunch"));
  check("canonical rejects raw ADMS with guidance", route.includes("ADMS_USE_DEDICATED_ENDPOINT"));
  check("canonical never selects secret", !route.includes("authSecretHash: true"));
}

// ---------------------------------------------------------------------------
// 12. Shared pipeline — identity, idempotency, FK safety, parity (static)
// ---------------------------------------------------------------------------
{
  const pipe = read("lib/biometric-ingest.ts");
  check("pipeline resolves mappings first", pipe.includes("biometricUserMap.findUnique"));
  check("pipeline degrades pre-migration", pipe.includes("Pre-migration database"));
  check("pipeline guards non-student FK", pipe.includes("must never be"));
  check("pipeline guards batchless students", pipe.includes("no assigned batch"));
  check("pipeline preserves unknown-user audit", pipe.includes("processed: false"));
  check("pipeline keeps ABSENT trigger parity", pipe.includes("ATTENDANCE_ABSENT"));
  check("pipeline records device errors", pipe.includes("noteDeviceError"));
}

// ---------------------------------------------------------------------------
// 13. ADMS wire receiver — SN identity, allowlist, always-OK (static)
// ---------------------------------------------------------------------------
{
  const adms = read("app/api/biometric/adms/route.ts");
  check("adms identifies by SN", adms.includes("serialNumber"));
  check("adms unknown serial 404", adms.includes("UNKNOWN DEVICE"));
  check("adms enforces IP allowlist", adms.includes("allowlist"));
  check("adms batch stays OK", (adms.match(/return text\("OK"\)/g) ?? []).length >= 3);
  check("adms replies plain text", adms.includes("text/plain"));
  check("rewrite maps /iclock", read("next.config.mjs").includes("/iclock/:path*"));
}

// ---------------------------------------------------------------------------
// 14. Mapping admin APIs — server-resolved, admin-only (static)
// ---------------------------------------------------------------------------
{
  const list = read("app/api/biometric/devices/[id]/mappings/route.ts");
  const one = read("app/api/biometric/devices/[id]/mappings/[mappingId]/route.ts");
  check("mappings list admin-only", list.includes('requireApiRole(req, ["ADMIN"])'));
  check("mappings create resolves server-side", list.includes("resolveMappingTarget"));
  check("mappings duplicate 409", list.includes("already mapped"));
  check("mapping item admin-only", one.includes('requireApiRole(req, ["ADMIN"])'));
  check("mapping scoped to device", one.includes("deviceId"));
}

// ---------------------------------------------------------------------------
// 15. Device admin APIs — secrets never readable (static)
// ---------------------------------------------------------------------------
{
  const dev = read("app/api/biometric/devices/route.ts");
  const det = read("app/api/biometric/devices/[id]/route.ts");
  check("device create provisions secret", dev.includes("provisionSecret"));
  check("device create warns one-time", dev.includes("never shown again"));
  check("device select excludes hash", !dev.includes("authSecretHash: true") && !det.includes("authSecretHash: true"));
  check("device rotation supported", det.includes("rotateSecret"));
}

// ---------------------------------------------------------------------------
// 16. Admin UI — detail reachable, mappings persistent (static)
// ---------------------------------------------------------------------------
{
  const listUi = read("app/admin/biometric-devices/page.tsx");
  const detUi = read("app/admin/biometric-device/page.tsx");
  check("list links existing detail route", listUi.includes("/admin/biometric-device?id="));
  check("list add-device posts API", listUi.includes('fetch("/api/biometric/devices"') && listUi.includes('method: "POST"'));
  check("detail reads searchParams id", detUi.includes("searchParams"));
  check("detail lists persistent mappings", detUi.includes("/mappings") && detUi.includes("loadMappings"));
  check("detail mapping form has inputs", detUi.includes("userKey") && detUi.includes("biometricUserId"));
  check("detail drops dead mapping endpoint", !detUi.includes("/api/biometric/mapping\""));
}

// ---------------------------------------------------------------------------
// 17. Manual-attendance compatibility untouched (static)
// ---------------------------------------------------------------------------
{
  const att = read("app/api/attendance/route.ts");
  check("faculty cannot overwrite biometric rows", att.includes("cannot be overwritten by manual entry") && att.includes("409"));
  check("manual ABSENT trigger intact", att.includes("ATTENDANCE_ABSENT"));
}

// ---------------------------------------------------------------------------
// 18. Bridge forwarder present and secret-safe (static)
// ---------------------------------------------------------------------------
{
  check("bridge file exists", existsSync(join(ROOT, "adms-bridge.js")));
  const bridge = read("adms-bridge.js");
  check("bridge forwards with bearer", bridge.includes("Authorization"));
  check("bridge never logs secrets", !bridge.includes("console.log") || !/console\.log\([^)]*SECRET[^)]*\+/.test(bridge));
  check("bridge acks unknown tables", bridge.includes("OK"));
  check("bridge has health endpoint", bridge.includes("/healthz"));
}

console.log(`biometric-check: ${pass} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
