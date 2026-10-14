# Biometric Integration Status

## CURRENT STATUS

### Device Information
- **Manufacturer:** eSSL
- **Model:** K90 Pro
- **Device Family/Platform:** x2000
- **Firmware:** 8.0.4.3-20230515
- **Push Service:** 2.0.33S-20220613
- **Protocol/Server Mode:** ADMS
- **Current Server:** 52.74.152.9
- **Current Port:** 8787
- **Enable Domain Name:** OFF
- **Proxy:** OFF
- **Device Capacity:** 431/8000 users
- **Fingerprints:** 13/800
- **Cards:** 418/800
- **T&A Records:** 37,594/80,000

### Current Configuration Status
- **Device Uses ADMS Mode:** Yes (per physical configuration)
- **Current Server 52.74.152.9:8787 Ownership:** **UNKNOWN**
- **Actual K90 Wire Protocol:** **NOT CAPTURED** - No live traffic captured yet
- **VPS/Physical Traffic Capture:** **PENDING** - Listener infrastructure ready, physical test pending

### Implementation Status

#### ✅ Completed
- **BiometricDevice model** - Prisma schema with device registration, health tracking, event counters
- **BiometricDeviceEvent model** - Audit log with payloadHash for idempotency, processed flag, attendance linkage
- **BiometricUserMap model** - Persistent enrollment binding (deviceId + PIN → Student/Faculty), migration `20261014000000_biometric_usermap_auth` authored (apply via `db:deploy` at release; code degrades gracefully pre-migration)
- **Device auth framework** - Per-device shared secret (SHA-256 hash stored, plaintext shown once), constant-time compare, legacy-mode flagging until provisioned
- **Device health fields** - `lastHeartbeatAt`, `lastError` alongside `lastSeenAt`/counters
- **Attendance model** - Supports `source=BIOMETRIC`, `deviceId`, `checkIn`/`checkOut`, deduplication via `@@unique([studentId, date])`
- **Device Admin API** (`/api/biometric/devices`) - CRUD for device registration (admin-only), secret provision/rotation, secrets never selected
- **Mapping Admin APIs** (`/api/biometric/devices/[id]/mappings`, `.../[mappingId]`) - persistent create/toggle/delete with server-side record resolution
- **Canonical ingestion** (`POST /api/biometric/[deviceId]/events`) - bearer auth, mapping-first resolve, heartbeat handling, batchless/non-student guards, ABSENT-trigger parity, raw-body 422 guidance
- **ADMS wire receiver** (`/api/biometric/adms` + `/iclock/*` rewrite) - SN identification, IP allowlist, registration handshake, ATTLOG ingest, always-OK reply semantics; tolerant parser per the documented iClock PUSH family (firmware confirmation pending one live capture)
- **Shared pipeline** (`lib/biometric-ingest.ts` + `lib/adms.ts`) - single semantics for both entries (no parallel system)
- **Production bridge** (`adms-bridge.js`) - VPS :8787 listener → canonical forward with retries, health endpoint
- **Admin UI** - Device list (working add form), detail view (health, last error, secret rotation, events, persistent mappings)
- **Mocked regression suite** - `npm run biometric:check` (94 checks, no DB needed)
- **Schema Validation** - Prisma schema valid, clients regenerated, migrations authored (not applied here)
- **All Regression Checks Pass** - lint clean, build success, all existing suites green

#### ⚠️ Remaining (hardware/network-dependent only)
- **Firmware confirmation capture** - One live K90 capture to confirm exact paths/params/response expectations (receiver is tolerant by design; see "Real-punch test" below)
- **Secret provisioning** - Provision per-device secrets at deployment (one admin action per device)
- **VPS bridge deployment** - Bridge host + port 8787 + forwarding config (procedure below)
- **Production migration apply** - `20261014000000_biometric_usermap_auth` via `db:deploy` at release (standard procedure, see PRISMA_MIGRATIONS.md)

---

## NEXT PHYSICAL STEP: VPS + Controlled K90 Traffic Capture

### Prerequisites
1. VPS with public IP, port 8787 open
2. Deploy `adms-capture-listener.js` on VPS
3. On-site operator with physical K90 Pro access
3. Test user enrolled on device for controlled attendance scan

### Capture Procedure
1. **Backup** current K90 Pro config (server=52.74.152.9:8787, Domain=OFF, Proxy=OFF)
2. Deploy listener on VPS: `PORT=8787 node adms-capture-listener.js`
4. Change K90 Pro server to VPS IP:8787
5. Wait for registration/heartbeat → capture
5. Trigger ONE controlled attendance scan → capture
6. Stop listener, restore device to 52.74.152.9:8787
7. Analyze capture → document exact protocol

### Capture Analysis Targets
- HTTP method, exact path, query params, Content-Type, User-Agent
- Device serial/MAC identification fields
- Biometric user ID field name/format
- Timestamp field format/timezone
- Event type values (CHECK_IN/CHECK_OUT/etc.)
- Heartbeat interval and format
- Expected server response format
- Authentication mechanism (if any)
- Payload encryption/signing

---

## Architecture (Post-Capture)

```
K90 Pro (ADMS)
    ↓
VPS:8787 (TCP/HTTP listener + capture)
    ↓
Reverse Proxy (nginx/HAProxy) → HTTPS
    ↓
Next.js API: POST /api/biometric/[deviceId]/events
    ↓
Supabase (Attendance + BiometricDeviceEvent + BiometricUserMap)
```

---

## Persistent Mapping Design (Ready for Migration)

```prisma
model BiometricUserMap {
  id              String       @id @default(cuid())
  deviceId        String       @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  biometricUserId String       // Raw ID from device (e.g., "001", "EMP001")
  userType        UserType     // STUDENT | FACULTY
  userId          String       // Student.id or Faculty.id
  isActive        Boolean      @default(true)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@unique([deviceId, biometricUserId])
  @@index([userType, userId])
}

enum UserType {
  STUDENT
  FACULTY
}
```

---

## Security Status

| Control | Status |
|---------|--------|
| Admin-only device management | ✅ |
| Device event endpoint deviceId validation | ✅ |
| Device active status check | ✅ |
| Per-device shared secret (constant-time, hashed) | ✅ framework (provision at deploy) |
| IP allowlist on ADMS pushes (when configured) | ✅ |
| Idempotency (payloadHash SHA-256) | ✅ |
| Unknown user audit preservation | ✅ |
| **Firmware-specific protocol confirmation** | ⚠️ Tolerant receiver live; one capture still required |
| **Replay protection** | ⚠️ Partial (idempotency only) |
| Device credentials server-side only | ✅ |
| IDOR protection | ✅ |
| No secrets in logs | ✅ |

**DEVICE_AUTH_GAP → narrowed:** canonical ingestion now enforces an optional
per-device bearer secret; unprovisioned devices are accepted in flagged
legacy mode. Raw ADMS pushes authenticate by network identity (SN +
optional IP allowlist) — the protocol family defines no stronger mechanism,
so the bridge (bearer secret to Next.js) is the trusted path.

---

## Network evidence (2026-10-14)

- `52.74.152.9:8787` — **TCP connect SUCCEEDS** (PowerShell
  Test-NetConnection, TcpTestSucceeded=True; ICMP ping blocked, normal for
  AWS). Something is listening there. Its software identity is UNKNOWN —
  do NOT assume it is ours, and do NOT point the device away from it without
  authorization. It is most likely the previous vendor's ADMS server.
- Vercel cannot listen on arbitrary TCP ports — the VPS bridge is therefore
  mandatory for device pushes, regardless of the above.

---

## VPS bridge deployment (production path)

1. Provision a host with a public IP; open TCP 8787 inbound.
2. Copy `adms-bridge.js` (dependency-free, Node 20+). No `npm install` needed.
3. Register the K90 in Admin → Biometric Devices (provision secret, copy once).
4. Run: `PORT=8787 NEXT_API_URL=https://<next-host> DEVICE_ID=<cuid> DEVICE_SECRET=<secret> node adms-bridge.js`
   (multi-device: `BRIDGE_DEVICES_JSON` instead; keep under a process manager.)
5. Verify: `GET http://<vps>:8787/healthz` → counters JSON.
6. Apply the migration at release: `npm run db:deploy` (standard procedure).

---

## Real-punch test (exact instructions, K90 Pro)

Prerequisites: bridge running (above), device mapped (Admin → device →
mapping PIN → Student ID), student has an assigned batch.

1. **Backup** current K90 config (server=52.74.152.9:8787, Domain=OFF, Proxy=OFF).
2. Point the K90 server to the VPS IP:8787 (Menu → Comm → Server Setting).
3. Wait 1–5 min for registration (`/healthz` registrations counter + device Last Heartbeat in admin).
4. Enroll/scan ONE test fingerprint (note the enrollment PIN, e.g. 1042).
5. Confirm in Admin → device → Recent Events: event row PROCESSED=Yes with attendance link; check `/admin/attendance` for the BIOMETRIC row.
6. Scan the SAME finger again → duplicate counter path (no second attendance row).
7. Restore the device to 52.74.152.9:8787. Report the capture/bridge log only (no secrets).

---

## Remaining Blockers

| Blocker | Severity | Resolution |
|---------|----------|------------|
| **Firmware confirmation capture** | 🟡 MEDIUM | One live capture; receiver is tolerant, not blocked |
| **Secret provisioning** | 🟡 MEDIUM | One admin action per device at deploy |
| **VPS bridge deployment** | 🟡 MEDIUM | Host + :8787 + env config (procedure above) |
| **Migration apply at release** | 🟢 LOW | Standard `db:deploy` (code degrades gracefully until then) |
| **Port 8787 / Vercel incompatibility** | 🟢 RESOLVED | Bridge architecture (this change set) |
| **Persistent mapping table** | 🟢 RESOLVED | `BiometricUserMap` + admin APIs (this change set) |
| **Broken device detail + dead Add button** | 🟢 RESOLVED | searchParams routing + working forms (this change set) |
| **Missing mapping endpoint** | 🟢 RESOLVED | Persistent CRUD APIs (this change set) |

---

## Regression Checks (2026-10-14, all PASS)

| Check | Status |
|-------|--------|
| `npx prisma validate` | ✅ valid |
| `npx prisma generate` | ✅ both clients |
| `npm run biometric:check` | ✅ 94 passed (new mocked suite) |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run build` | ✅ |
| `npm run security:check` | ✅ 97 passed |
| `npm run runtime:check` | ✅ 36 passed |
| `npm run storage:check` | ✅ 59 passed |
| `npm run faculty:check` | ✅ 43 passed |
| `npm run admin:check` | ✅ 114 passed |
| `npm run student:check` | ✅ 74 passed |
| `npm run notification:check` | ✅ 234 passed |
| `npm run attempt:check` | ✅ 53 passed |
| `npm run website:check` | ✅ 71 passed |
| `npm run otp:check` | ✅ 63 passed |

---

## Git Status

Working tree contains this change set, uncommitted (commit only on
explicit approval). No `.env` values read or changed, no database
operations performed, nothing deployed or pushed.
  - app/globals.css (comment fix)
  - prisma/schema.prisma

Untracked (Capture Infrastructure):
  - ADMS-CAPTURE-README.md
  - adms-capture-listener.js
  - package-capture.json
  - adms-capture-logs/ (gitignored)
```

---

## Change Record (uncommitted — approval required)

Files added: `lib/adms.ts`, `lib/biometric-ingest.ts`,
`app/api/biometric/adms/route.ts`,
`app/api/biometric/devices/[id]/mappings/route.ts`,
`app/api/biometric/devices/[id]/mappings/[mappingId]/route.ts`,
`adms-bridge.js`, `scripts/biometric-check.ts`,
`prisma/migrations/20261014000000_biometric_usermap_auth/migration.sql`.
Files modified: `prisma/schema.prisma`, `package.json`, `next.config.mjs`,
`app/api/biometric/[deviceId]/events/route.ts`,
`app/api/biometric/devices/route.ts`,
`app/api/biometric/devices/[id]/route.ts`,
`app/admin/biometric-devices/page.tsx`,
`app/admin/biometric-device/page.tsx`, this status file.

**DO NOT PUSH. DO NOT TAG. DO NOT DEPLOY without approval.**