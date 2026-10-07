// Phase 12A — X2000 ADMS Biometric Event Ingestion
// GET  /api/biometric/[deviceId]/events     — List recent events for a device
// POST /api/biometric/[deviceId]/events     — Ingest ADMS event from X2000 device

import { NextRequest, NextResponse } from "next/server";
import { fail, ok, dbNotConfigured } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { resolveUser } from "@/lib/testAccess";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helper: compute deterministic payloadHash for idempotency
// ---------------------------------------------------------------------------
function computePayloadHash(
  biometricUserId: string,
  eventType: string,
  eventTimestamp: number,
  rawPayload: Record<string, unknown>
): string {
  const normalized = {
    biometricUserId,
    eventType,
    eventTimestamp: typeof eventTimestamp === "number" ? eventTimestamp : Date.parse(String(eventTimestamp)),
    ...rawPayload,
  };
  const payloadString = JSON.stringify(normalized, Object.keys(normalized).sort());
  return crypto.createHash("sha256").update(payloadString).digest("hex");
}

// ---------------------------------------------------------------------------
// Helper: map biometricUserId to Student or Faculty
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- @prisma/client types pre-date the biometric delegates (client-regeneration follow-up); runtime uses the generated client which includes them.
async function resolveUser(db: any, biometricUserId: string) {
  // Try Student first (most common case) — check studentId or email
  const student = await db.student.findFirst({
    where: {
      OR: [
        { studentId: biometricUserId },
        { email: biometricUserId.toLowerCase() },
      ],
    },
    select: { id: true, studentId: true, name: true, batchId: true, status: true },
  });
  if (student) return { type: "student", ...student };

  // Try Faculty
  const faculty = await db.faculty.findFirst({
    where: { facultyId: biometricUserId },
    select: { id: true, facultyId: true, name: true, status: true },
  });
  if (faculty) return { type: "faculty", ...faculty };

  // Try User email fallback
  const user = await db.user.findFirst({
    where: { email: biometricUserId.toLowerCase() },
    select: { id: true, email: true, name: true, role: true },
  });
  if (user) return { type: "user", ...user };

  return null;
}

// ---------------------------------------------------------------------------
// Helper: determine checkIn/checkOut from eventType
// ---------------------------------------------------------------------------
function determineAttendanceStatus(eventType: string): "PRESENT" | "ABSENT" | "LATE" | "LEAVE" {
  const lower = eventType.toUpperCase();
  if (lower.includes("CHECK_IN") || lower.includes("ENTER") || lower.includes("ARRIVE")) return "PRESENT";
  if (lower.includes("CHECK_OUT") || lower.includes("EXIT") || lower.includes("LEAVE")) return "LEAVE";
  if (lower.includes("LATE") || lower.includes("TARDY")) return "LATE";
  return "PRESENT"; // default
}

// ---------------------------------------------------------------------------
// GET /api/biometric/[deviceId]/events — List recent events for a device
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const db = getDb();
  if (!db) return dbNotConfigured("Loading device events");

  // 1. Identify the device
  const { deviceId } = await params;
  const device = await db.biometricDevice.findUnique({
    where: { id: deviceId },
  });
  if (!device) return fail(`Unknown biometric device ID "${deviceId}".`, 404);

  // 2. Return recent events
  const events = await db.biometricDeviceEvent.findMany({
    where: { deviceId: device.id },
    orderBy: { eventTimestamp: "desc" },
    take: 50,
    include: { attendance: true },
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
// POST /api/biometric/[deviceId]/events — Ingest ADMS event from X2000 device
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const db = getDb();
  if (!db) return dbNotConfigured("Processing biometric event");

  // 1. Identify the device
  const { deviceId } = await params;
  const device = await db.biometricDevice.findUnique({
    where: { id: deviceId },
  });
  if (!device) return fail(`Unknown biometric device ID "${deviceId}".`, 404);
  if (!device.isActive) return fail(`Device "${device.name}" is inactive.`, 403);

  // 2. Parse and validate payload
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const biometricUserId = String(body?.biometricUserId ?? "").trim();
  const eventType = String(body?.eventType ?? "").trim();
  const eventTimestamp = body?.eventTimestamp;

  const missing = ["biometricUserId", "eventType"].filter(
    (f) => !(body as Record<string, unknown>)[f] && String((body as Record<string, unknown>)[f]).trim().length > 0
  );
  if (missing.length > 0) {
    return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  }
  if (!biometricUserId) return fail("biometricUserId must not be empty.", 400);
  if (!eventType) return fail("eventType must not be empty.", 400);

  // 3. Normalize eventTimestamp to Date
  const parsedTimestamp = typeof eventTimestamp === "number"
    ? new Date(eventTimestamp)
    : eventTimestamp
      ? new Date(String(eventTimestamp))
      : new Date();

  if (Number.isNaN(parsedTimestamp.getTime())) {
    return fail("Invalid eventTimestamp.", 400);
  }

  // 4. Compute payloadHash for idempotency
  const rawPayload = { ...body };
  delete rawPayload.biometricUserId;
  delete rawPayload.eventType;
  delete rawPayload.eventTimestamp;
  const payloadHash = computePayloadHash(biometricUserId, eventType, parsedTimestamp.getTime(), rawPayload);

  // 5. Check for duplicate delivery (idempotency)
  const existingEvent = await db.biometricDeviceEvent.findFirst({
    where: {
      deviceId: device.id,
      biometricUserId,
      eventTimestamp: parsedTimestamp,
      payloadHash,
    },
    include: { attendance: true },
  });

  if (existingEvent) {
    // Duplicate delivery — make idempotent
    if (existingEvent.attendance) {
      return ok({
        eventId: existingEvent.id,
        duplicate: true,
        attendance: {
          id: existingEvent.attendance.id,
          studentId: existingEvent.attendance.studentId,
          date: existingEvent.attendance.date,
          status: existingEvent.attendance.status,
          source: existingEvent.attendance.source,
          checkIn: existingEvent.attendance.checkIn,
          checkOut: existingEvent.attendance.checkOut,
        },
        deviceLastSeenAt: device.lastSeenAt,
        totalEvents: device.totalEvents,
        failedEvents: device.failedEvents,
        message: "Event already processed — delivery idempotent.",
      });
    }
    return ok({
      eventId: existingEvent.id,
      duplicate: true,
      attendance: null,
      deviceLastSeenAt: device.lastSeenAt,
      totalEvents: device.totalEvents,
      failedEvents: device.failedEvents,
      message: "Event record already exists but attendance was not created (unmapped user).",
    });
  }

  // 6. Resolve biometricUserId to Student or Faculty
  const userMapping = await resolveUser(db, biometricUserId);
  if (!userMapping) {
    // Unknown user — preserve for audit, mark as failed
    await db.biometricDeviceEvent.create({
      data: {
        deviceId: device.id,
        biometricUserId,
        eventType,
        eventTimestamp: parsedTimestamp,
        payloadHash,
        processed: false,
        receivedAt: new Date(),
      },
    });
    await db.biometricDevice.update({
      where: { id: device.id },
      data: {
        totalEvents: { increment: 1 },
        failedEvents: { increment: 1 },
        lastSeenAt: parsedTimestamp,
      },
    });
    return fail(
      `Unknown biometric user ID "${biometricUserId}" — event preserved for audit, no attendance created.`,
      409
    );
  }

  // 7. Determine attendance status from eventType
  const attendanceStatus = determineAttendanceStatus(eventType);

  // 8. Upsert attendance with BIOMETRIC source and deduplication
  const date = parsedTimestamp.toISOString().split("T")[0];
  let attendanceRecord;
  try {
    attendanceRecord = await db.attendance.upsert({
      where: {
        studentId_date: {
          studentId: userMapping.id,
          date: date,
        },
      },
      update: {
        status: attendanceStatus,
        checkIn: attendanceStatus === "PRESENT" ? parsedTimestamp : undefined,
        checkOut: attendanceStatus === "LEAVE" || attendanceStatus === "ABSENT" ? parsedTimestamp : undefined,
        source: "BIOMETRIC",
        deviceId: device.id,
      },
      create: {
        studentId: userMapping.id,
        batchId: userMapping.batchId || undefined,
        date: date,
        status: attendanceStatus,
        source: "BIOMETRIC",
        checkIn: attendanceStatus === "PRESENT" ? parsedTimestamp : undefined,
        checkOut: attendanceStatus === "LEAVE" || attendanceStatus === "ABSENT" ? parsedTimestamp : undefined,
        deviceId: device.id,
      },
    });
  } catch (err) {
    const existing = await db.attendance.findFirst({
      where: { studentId: userMapping.id, date },
    });
    if (existing) attendanceRecord = existing;
    else throw err;
  }

  // 9. Create BiometricDeviceEvent record
  await db.biometricDeviceEvent.create({
    data: {
      deviceId: device.id,
      biometricUserId,
      eventType,
      eventTimestamp: parsedTimestamp,
      payloadHash,
      processed: true,
      attendanceId: attendanceRecord.id,
      receivedAt: new Date(),
    },
  });

  // 10. Update device counters
  await db.biometricDevice.update({
    where: { id: device.id },
    data: {
      totalEvents: { increment: 1 },
      lastSeenAt: parsedTimestamp,
    },
  });

  // 11. Return protocol-compliant response
  return ok({
    duplicate: false,
    attendance: {
      id: attendanceRecord.id,
      studentId: attendanceRecord.studentId,
      date: attendanceRecord.date,
      status: attendanceRecord.status,
      source: attendanceRecord.source,
      checkIn: attendanceRecord.checkIn,
      checkOut: attendanceRecord.checkOut,
    },
    device: {
      id: device.id,
      name: device.name,
      serialNumber: device.serialNumber,
      isActive: device.isActive,
      lastSeenAt: device.lastSeenAt,
      totalEvents: device.totalEvents,
      failedEvents: device.failedEvents,
    },
    eventType,
    eventTimestamp: parsedTimestamp.toISOString(),
    message: "Biometric event processed successfully.",
  });
}