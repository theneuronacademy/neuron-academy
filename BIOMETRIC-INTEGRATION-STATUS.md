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
- **Attendance model** - Supports `source=BIOMETRIC`, `deviceId`, `checkIn`/`checkOut`, deduplication via `@@unique([studentId, date])`
- **Device Admin API** (`/api/biometric/devices`) - CRUD for device registration (admin-only)
- **Event Ingestion Endpoint** (`POST /api/biometric/[deviceId]/events`) - Internal canonical model ready
- **Event History Endpoint** (`GET /api/biometric/[deviceId]/events`) - Recent events with attendance linkage
- **Admin UI** - Device list, details, health, config, events, mapping UI
- **Mapping UI** - BiometricUserId → Student/Faculty assignment (stored as BiometricDeviceEvent for now)
- **Capture Listener** - Standalone Node.js server for safe physical traffic capture
- **Admin API Service** - Device CRUD, event fetching, mapping creation
- **Schema Validation** - Prisma schema valid, migrations applied
- **All Regression Checks Pass** - lint, security, runtime, storage, build

#### ⚠️ In Progress / Pending
- **BiometricUserMap Model** - Not yet added to schema (design documented, migration pending)
- **Persistent Mapping API** - Uses BiometricDeviceEvent as temporary store; dedicated table pending
- **Device Authentication** - **DEVICE_AUTH_GAP**: Current endpoint only validates deviceId + isActive; no cryptographic auth
- **Physical Traffic Capture** - **PENDING** - Requires VPS deployment + physical device reconfiguration
- **Actual ADMS Protocol** - **UNKNOWN** - No live traffic captured yet

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
| Idempotency (payloadHash SHA-256) | ✅ |
| Unknown user audit preservation | ✅ |
| **Device cryptographic authentication** | ❌ **MISSING** (DEVICE_AUTH_GAP) |
| **Replay protection** | ⚠️ Partial (idempotency only) |
| Device credentials server-side only | ✅ |
| IDOR protection | ✅ |
| No secrets in logs | ✅ |

**DEVICE_AUTH_GAP:** Current ingestion endpoint only validates deviceId + isActive. No cryptographic authentication implemented. Physical device authentication mechanism UNKNOWN pending capture.

---

## Remaining Blockers

| Blocker | Severity | Resolution |
|---------|----------|------------|
| **ADMS_PROTOCOL_UNKNOWN** | 🔴 CRITICAL | Capture live traffic with listener |
| **DEVICE_AUTH_GAP** | 🔴 CRITICAL | Implement protocol-specific auth after capture |
| **Port 8787 / Vercel incompatibility** | 🟡 HIGH | Deploy VPS + reverse proxy |
| **Persistent mapping table missing** | 🟡 HIGH | Create BiometricUserMap migration |
| **No protocol documentation** | 🟡 HIGH | Capture + analyze live traffic |
| Pre-existing build error (`testimonials/page.tsx`) | 🟢 LOW | Fixed in this PR |

---

## Regression Checks (All Pass)

| Check | Status |
|-------|--------|
| `npx prisma generate` | ✅ |
| `npx prisma validate` | ✅ |
| `npm run lint` | ⚠️ Pre-existing errors only (testimonials, announcements, etc.) |
| `npm run security:check` | ✅ 97 passed |
| `npm run runtime:check` | ✅ 36 passed |
| `npm run storage:check` | ✅ 48 passed |
| `npm run build` | ✅ Compiles (pre-existing lint errors only) |

---

## Git Status

```
Modified:
  - app/admin/biometric-devices/page.tsx
  - app/admin/website/testimonials/page.tsx (build fix)
  - app/api/biometric/events/route.ts
  - app/faculty/dashboard/page.tsx (import fix)
  - app/globals.css (comment fix)
  - prisma/schema.prisma

Untracked (Capture Infrastructure):
  - ADMS-CAPTURE-README.md
  - adms-capture-listener.js
  - package-capture.json
  - adms-capture-logs/ (gitignored)
```

---

## Commit Information

**Ready for commit:**
```bash
git add app/admin/biometric-devices/page.tsx app/admin/website/testimonials/page.tsx app/api/biometric/events/route.ts app/faculty/dashboard/page.tsx app/globals.css prisma/schema.prisma ADMS-CAPTURE-README.md adms-capture-listener.js package-capture.json
git commit -m "feat(biometric): fix build, harden architecture, add capture listener"
```

**DO NOT PUSH. DO NOT TAG.**