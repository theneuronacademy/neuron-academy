// Phase 12B — Admin Biometric Device Services
// These services consume the Phase 12A biometric device APIs.

import { getDb } from "@/lib/prisma";

/** GET /api/biometric/devices */
export async function getBiometricDevices() {
  const db = getDb();
  if (!db) return null;
  try {
    return await db.biometricDevice.findMany({
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
  } catch {
    return null;
  }
}

/** GET /api/biometric/devices/[id] */
export async function getBiometricDevice(id: string) {
  const db = getDb();
  if (!db) return null;
  try {
    return await db.biometricDevice.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        serialNumber: true,
        deviceType: true,
        ipAddress: true,
        port: true,
        protocol: true,
        location: true,
        isActive: true,
        lastSeenAt: true,
        totalEvents: true,
        failedEvents: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch {
    return null;
  }
}

/** PATCH /api/biometric/devices/[id] */
export async function toggleBiometricDevice(id: string, isActive: boolean) {
  const db = getDb();
  if (!db) return { success: false };
  try {
    await db.biometricDevice.update({
      where: { id },
      data: { isActive },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

/** GET /api/biometric/devices/[deviceId]/events */
export async function getDeviceEvents(deviceId: string) {
  const db = getDb();
  if (!db) return { success: false, events: [] };
  try {
    const events = await db.biometricDeviceEvent.findMany({
      where: { deviceId },
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
    return { success: true, events };
  } catch {
    return { success: false, events: [] };
  }
}

/** POST /api/biometric/mapping */
export async function createBiometricMapping(
  biometricUserId: string,
  userType: "student" | "faculty",
  userId: string
) {
  const db = getDb();
  if (!db) return { success: false };
  try {
    // Validate user exists
    let targetId = userId;
    if (userType === "student") {
      const student = await db.student.findUnique({ where: { id: userId } });
      if (!student) return { success: false, error: "Student not found." };
      targetId = student.id;
    } else {
      const faculty = await db.faculty.findUnique({ where: { id: userId } });
      if (!faculty) return { success: false, error: "Faculty not found." };
      targetId = faculty.id;
    }

    // Create a mapping event record
    const event = await db.biometricDeviceEvent.create({
      data: {
        deviceId: "", // Will be set by actual ingestion; for manual mapping we just link
        biometricUserId,
        eventType: "MANUAL_MAPPING",
        eventTimestamp: new Date(),
        payloadHash: crypto.createHash("sha256").update(biometricUserId).digest("hex"),
        processed: true,
        attendanceId: targetId,
        receivedAt: new Date(),
      },
    });

    return { success: true, event };
  } catch {
    return { success: false, error: "Failed to create mapping." };
  }
}