// Shared biometric punch pipeline — SERVER-SIDE ONLY.
// Both ingestion entries (canonical JSON at /api/biometric/[deviceId]/events
// and raw ADMS at /api/biometric/adms) run through processBiometricPunch so
// the two paths can never disagree on identity, idempotency, or guards.

import {
  computePayloadHash,
  isHeartbeatEventType,
  mapAttStatus,
} from "@/lib/adms";
import { canonicalNotificationType } from "@/lib/notification-events";
import { notifyMessages } from "@/lib/notify";
import { dispatchNotification } from "@/services/notificationEngine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime Db may pre-date the BiometricUserMap migration; mapping lookup degrades gracefully.
export type IngestDb = any;

export interface IngestDevice {
  id: string;
  name: string;
  isActive: boolean;
}

export interface PunchInput {
  biometricUserId: string;
  /** Canonical type (CHECK_IN/...) or ADMS numeric status as string. */
  eventType: string;
  eventTimestamp: Date;
  extra: Record<string, unknown>;
  /** When true, eventType is an ADMS numeric punch status ("0".."5"). */
  admsStatus?: number;
}

export interface ResolvedStudent {
  kind: "student";
  id: string;
  studentId: string;
  name: string;
  batchId: string | null;
  status: string;
}

export interface ResolvedNonStudent {
  kind: "non-student";
  userType: string;
  id: string;
  name: string;
}

export type PunchOutcome =
  | { outcome: "heartbeat" }
  | { outcome: "duplicate"; eventId: string; attendance: Record<string, unknown> | null }
  | { outcome: "unknown-user"; reason: string }
  | { outcome: "non-student"; userType: string; name: string }
  | { outcome: "batchless"; reason: string }
  | {
      outcome: "ingested";
      attendance: Record<string, unknown>;
      attendanceStatus: string;
      viaMapping: boolean;
    }
  | { outcome: "failed"; reason: string };

export async function noteDeviceError(db: IngestDb, deviceId: string, message: string): Promise<void> {
  try {
    await db.biometricDevice.update({
      where: { id: deviceId },
      data: { failedEvents: { increment: 1 }, lastError: message.slice(0, 300) },
    });
  } catch {
    /* bookkeeping must never fail ingestion */
  }
}

export async function touchDeviceSeen(
  db: IngestDb,
  deviceId: string,
  at: Date,
  opts: { heartbeat?: boolean; countEvent?: boolean } = {}
): Promise<void> {
  try {
    await db.biometricDevice.update({
      where: { id: deviceId },
      data: {
        ...(opts.countEvent === false ? {} : { totalEvents: { increment: 1 } }),
        lastSeenAt: at,
        ...(opts.heartbeat ? { lastHeartbeatAt: at } : {}),
        lastError: null,
      },
    });
  } catch {
    /* best-effort */
  }
}

async function legacyResolve(
  db: IngestDb,
  biometricUserId: string
): Promise<ResolvedStudent | ResolvedNonStudent | null> {
  const student = await db.student.findFirst({
    where: { OR: [{ studentId: biometricUserId }, { email: biometricUserId.toLowerCase() }] },
    select: { id: true, studentId: true, name: true, batchId: true, status: true },
  });
  if (student) return { kind: "student", ...student };

  const faculty = await db.faculty.findFirst({
    where: { facultyId: biometricUserId },
    select: { id: true, facultyId: true, name: true },
  });
  if (faculty) return { kind: "non-student", userType: "FACULTY", id: faculty.id, name: faculty.name };

  const user = await db.user.findFirst({
    where: { email: biometricUserId.toLowerCase() },
    select: { id: true, email: true, name: true, role: true },
  });
  if (user) return { kind: "non-student", userType: user.role, id: user.id, name: user.name };

  return null;
}

export async function resolveBiometricUser(  db: IngestDb,
  deviceId: string,
  biometricUserId: string
): Promise<{ resolved: ResolvedStudent | ResolvedNonStudent | null; viaMapping: boolean }> {
  try {
    const mapping = await db.biometricUserMap.findUnique({
      where: { deviceId_biometricUserId: { deviceId, biometricUserId } },
    });
    if (mapping) {
      if (!mapping.isActive) return { resolved: null, viaMapping: true };
      if (mapping.userType === "STUDENT") {
        const student = await db.student.findUnique({
          where: { id: mapping.userId },
          select: { id: true, studentId: true, name: true, batchId: true, status: true },
        });
        return { resolved: student ? { kind: "student", ...student } : null, viaMapping: true };
      }
      const faculty = await db.faculty.findUnique({
        where: { id: mapping.userId },
        select: { id: true, facultyId: true, name: true },
      });
      return {
        resolved: faculty
          ? { kind: "non-student", userType: "FACULTY", id: faculty.id, name: faculty.name }
          : null,
        viaMapping: true,
      };
    }
  } catch {
    // Pre-migration database: fall through to legacy resolution.
  }
  return { resolved: await legacyResolve(db, biometricUserId), viaMapping: false };
}

function canonicalTypeFor(input: PunchInput): string {
  if (input.admsStatus !== undefined) {
    return input.admsStatus === 1 ? "CHECK_OUT" : "CHECK_IN";
  }
  return input.eventType;
}

function statusFor(input: PunchInput): "PRESENT" | "ABSENT" | "LATE" | "LEAVE" {
  if (input.admsStatus !== undefined) return mapAttStatus(input.admsStatus);
  const lower = input.eventType.toUpperCase();
  if (lower.includes("CHECK_IN") || lower.includes("ENTER") || lower.includes("ARRIVE")) return "PRESENT";
  if (lower.includes("CHECK_OUT") || lower.includes("EXIT") || lower.includes("LEAVE")) return "LEAVE";
  if (lower.includes("LATE") || lower.includes("TARDY")) return "LATE";
  return "PRESENT";
}

async function preserveAudit(
  db: IngestDb,
  deviceId: string,
  input: PunchInput,
  payloadHash: string
): Promise<void> {
  await db.biometricDeviceEvent
    .create({
      data: {
        deviceId,
        biometricUserId: input.biometricUserId,
        eventType: canonicalTypeFor(input),
        eventTimestamp: input.eventTimestamp,
        payloadHash,
        processed: false,
        receivedAt: new Date(),
      },
    })
    .catch(() => null);
}

/**
 * Run one punch through the full pipeline. Never throws for expected
 * domain outcomes (unknown/batchless/non-student/duplicates are outcomes,
 * not exceptions). Throws only on unexpected DB failures.
 */
export async function processBiometricPunch(
  db: IngestDb,
  device: IngestDevice,
  input: PunchInput
): Promise<PunchOutcome> {
  if (input.admsStatus === undefined && isHeartbeatEventType(input.eventType)) {
    await touchDeviceSeen(db, device.id, new Date(), { heartbeat: true, countEvent: false });
    return { outcome: "heartbeat" };
  }

  const eventType = canonicalTypeFor(input);
  const payloadHash = computePayloadHash(
    input.biometricUserId,
    eventType,
    input.eventTimestamp.getTime(),
    input.extra
  );

  const existingEvent = await db.biometricDeviceEvent
    .findFirst({
      where: { deviceId: device.id, biometricUserId: input.biometricUserId, eventTimestamp: input.eventTimestamp, payloadHash },
    })
    .catch(() => null);
  if (existingEvent) {
    const linked = existingEvent.attendanceId
      ? await db.attendance.findUnique({ where: { id: existingEvent.attendanceId } }).catch(() => null)
      : null;
    return {
      outcome: "duplicate",
      eventId: existingEvent.id,
      attendance: linked
        ? {
            id: linked.id,
            studentId: linked.studentId,
            date: linked.date,
            status: linked.status,
            source: linked.source,
            checkIn: linked.checkIn,
            checkOut: linked.checkOut,
          }
        : null,
    };
  }

  const { resolved, viaMapping } = await resolveBiometricUser(db, device.id, input.biometricUserId);
  if (!resolved) {
    await preserveAudit(db, device.id, input, payloadHash);
    const reason = viaMapping
      ? `Biometric ID "${input.biometricUserId}" is mapped to a missing/disabled record — event preserved for audit, no attendance created.`
      : `Unknown biometric user ID "${input.biometricUserId}" — event preserved for audit, no attendance created. Map it under Admin → Biometric Devices.`;
    await noteDeviceError(db, device.id, reason);
    return { outcome: "unknown-user", reason };
  }

  // Non-student targets (faculty/staff presence) are audit-logged only.
  // Attendance.studentId references Student, so faculty IDs must never be
  // written there (FK violation + wrong linkage).
  if (resolved.kind === "non-student") {
    await preserveAudit(db, device.id, input, payloadHash);
    await touchDeviceSeen(db, device.id, input.eventTimestamp, {});
    return { outcome: "non-student", userType: resolved.userType, name: resolved.name };
  }

  if (!resolved.batchId) {
    await preserveAudit(db, device.id, input, payloadHash);
    const reason = `Student "${resolved.name}" has no assigned batch — event preserved, no attendance created. Assign a batch first.`;
    await noteDeviceError(db, device.id, reason);
    return { outcome: "batchless", reason };
  }

  const attendanceStatus = statusFor(input);
  const date = input.eventTimestamp.toISOString().split("T")[0];
  let attendanceRecord;
  try {
    attendanceRecord = await db.attendance.upsert({
      where: { studentId_date: { studentId: resolved.id, date } },
      update: {
        status: attendanceStatus,
        checkIn: attendanceStatus === "PRESENT" ? input.eventTimestamp : undefined,
        checkOut: attendanceStatus === "LEAVE" ? input.eventTimestamp : undefined,
        source: "BIOMETRIC",
        deviceId: device.id,
      },
      create: {
        studentId: resolved.id,
        batchId: resolved.batchId,
        date,
        status: attendanceStatus,
        source: "BIOMETRIC",
        checkIn: attendanceStatus === "PRESENT" ? input.eventTimestamp : undefined,
        checkOut: attendanceStatus === "LEAVE" ? input.eventTimestamp : undefined,
        deviceId: device.id,
      },
    });
  } catch {
    const existing = await db.attendance
      .findFirst({ where: { studentId: resolved.id, date } })
      .catch(() => null);
    if (existing) attendanceRecord = existing;
    else {
      await noteDeviceError(db, device.id, "Attendance upsert failed for a mapped student.");
      return { outcome: "failed", reason: "Attendance upsert failed." };
    }
  }

  await db.biometricDeviceEvent
    .create({
      data: {
        deviceId: device.id,
        biometricUserId: input.biometricUserId,
        eventType,
        eventTimestamp: input.eventTimestamp,
        payloadHash,
        processed: true,
        attendanceId: attendanceRecord.id,
        receivedAt: new Date(),
      },
    })
    .catch(() => null);

  await touchDeviceSeen(db, device.id, input.eventTimestamp, {});

  // Notification parity with manual attendance: ABSENT-only, one per
  // student/day, centralized engine. Never fails the write.
  if (attendanceRecord.status === "ABSENT") {
    try {
      const dayStart = new Date(input.eventTimestamp);
      dayStart.setHours(0, 0, 0, 0);
      const already = await db.notification
        .findFirst({
          where: {
            targetStudentId: resolved.id,
            type: canonicalNotificationType("ATTENDANCE_ABSENT"),
            createdAt: { gte: dayStart },
          },
          select: { id: true },
        })
        .catch(() => null);
      if (!already) {
        const dateStr = input.eventTimestamp.toISOString().slice(0, 10);
        const built = notifyMessages.attendanceAbsent(dateStr);
        await dispatchNotification(db, {
          event: "ATTENDANCE_ABSENT",
          actor: { id: device.id, role: "ADMIN" },
          audience: { kind: "INDIVIDUAL", studentId: resolved.id },
          title: built.title,
          message: built.message,
          templateKey: "ATTENDANCE_ABSENT",
          vars: { testDate: dateStr },
          internal: true,
          idempotencyKey: `ATTENDANCE_ABSENT:${resolved.id}:${dateStr}`,
        });
      }
    } catch {
      /* absence alert must never fail the attendance write */
    }
  }

  return {
    outcome: "ingested",
    attendance: {
      id: attendanceRecord.id,
      studentId: attendanceRecord.studentId,
      date: attendanceRecord.date,
      status: attendanceRecord.status,
      source: attendanceRecord.source,
      checkIn: attendanceRecord.checkIn,
      checkOut: attendanceRecord.checkOut,
    },
    attendanceStatus: attendanceRecord.status,
    viaMapping,
  };
}

// ---------------------------------------------------------------------------
// Mapping administration: resolve an admin-supplied key (display code or
// email) to the canonical record id. STUDENT accepts Student.studentId or
// email; FACULTY accepts Faculty.facultyId or email. Inactive records are
// rejected — mapping a disabled account must be a conscious re-activation,
// not an accident.
// ---------------------------------------------------------------------------
export async function resolveMappingTarget(
  db: IngestDb,
  userType: "STUDENT" | "FACULTY",
  userKey: string
): Promise<{ ok: true; userId: string; label: string } | { ok: false; error: string }> {
  const key = userKey.trim();
  if (!key) return { ok: false, error: "userKey must not be empty." };
  if (userType === "STUDENT") {
    const student = await db.student.findFirst({
      where: { OR: [{ studentId: key }, { email: key.toLowerCase() }] },
      select: { id: true, studentId: true, name: true, status: true },
    });
    if (!student) return { ok: false, error: `No student matches "${key}" (try Student ID or email).` };
    if (student.status !== "ACTIVE") {
      return { ok: false, error: `Student "${student.name}" is ${student.status} — reactivate first.` };
    }
    return { ok: true, userId: student.id, label: `${student.name} (${student.studentId})` };
  }
  const faculty = await db.faculty.findFirst({
    where: { OR: [{ facultyId: key }, { email: key.toLowerCase() }] },
    select: { id: true, facultyId: true, name: true, status: true },
  });
  if (!faculty) return { ok: false, error: `No faculty matches "${key}" (try Faculty ID or email).` };
  if (faculty.status !== "ACTIVE") {
    return { ok: false, error: `Faculty "${faculty.name}" is ${faculty.status} — reactivate first.` };
  }
  return { ok: true, userId: faculty.id, label: `${faculty.name} (${faculty.facultyId})` };
}
