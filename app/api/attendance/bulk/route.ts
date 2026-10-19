// Batch Attendance Bulk Upsert API
// Replaces N+1 POST calls with single transaction

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { missingFields, parseDate } from "@/lib/validation";
import { facultyBatchIds } from "@/lib/testAccess";
import { canonicalNotificationType } from "@/lib/notification-events";
import { notifyMessages } from "@/lib/notify";
import { dispatchNotification } from "@/services/notificationEngine";

export const dynamic = "force-dynamic";

const STATUSES = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;

interface BulkRecord {
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
}

interface BulkPayload {
  batchId: string;
  date: string; // YYYY-MM-DD
  records: BulkRecord[];
  source?: "MANUAL" | "BIOMETRIC";
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Bulk marking attendance");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const missing = missingFields(body, ["batchId", "date", "records"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);

  if (!Array.isArray(body.records) || body.records.length === 0) {
    return fail("Records array is required and must not be empty.", 400);
  }

  const date = parseDate(body.date);
  if (!date) return fail("Invalid date.", 400);

  const { batchId, records, source = "MANUAL" } = body;
  const batchIdStr = String(batchId);

  try {
    // Verify faculty has access to this batch
    if (auth.user.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (!allowed.includes(batchIdStr)) return fail("Forbidden: batch not assigned to you.", 403);
    }

    // Verify all students belong to this batch (or faculty's assigned batches)
    const studentIds = records.map((r) => r.studentId);
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, batchId: true },
    });

    const studentBatchMap = new Map(students.map((s) => [s.id, s.batchId]));
    const invalidStudents = studentIds.filter(
      (id) => !studentBatchMap.has(id) || studentBatchMap.get(id) !== batchIdStr
    );

    if (invalidStudents.length > 0) {
      return fail(`${invalidStudents.length} student(s) not found in this batch.`, 403);
    }

    // Check for existing biometric records that faculty cannot overwrite
    const existingRecords = await db.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        date,
        source: "BIOMETRIC",
      },
      select: { studentId: true },
    });

    const biometricStudentIds = new Set(existingRecords.map((r) => r.studentId));
    const biometricConflicts = records.filter((r) => biometricStudentIds.has(r.studentId));

    if (biometricConflicts.length > 0 && auth.user.role === "FACULTY") {
      return fail(
        `${biometricConflicts.length} student(s) have biometric attendance for this date and cannot be overwritten by manual entry. Contact admin.`,
        409
      );
    }

    // Perform bulk upsert in a transaction
    const results = await db.$transaction(async (tx) => {
      const createdOrUpdated: Array<{ studentId: string; status: string }> = [];

      for (const record of records) {
        if (!STATUSES.includes(record.status)) continue;

        const existing = await tx.attendance.findUnique({
          where: { studentId_date: { studentId: record.studentId, date } },
        });

        // Skip biometric records for faculty
        if (existing?.source === "BIOMETRIC" && auth.user.role === "FACULTY") {
          continue;
        }

        const row = await tx.attendance.upsert({
          where: { studentId_date: { studentId: record.studentId, date } },
          update: {
            status: record.status,
            source: source as "MANUAL" | "BIOMETRIC",
          },
          create: {
            studentId: record.studentId,
            batchId: batchIdStr,
            date,
            status: record.status,
            source: source as "MANUAL" | "BIOMETRIC",
          },
        });

        createdOrUpdated.push({ studentId: row.studentId, status: row.status });
      }

      return createdOrUpdated;
    });

    // Send notifications for absences and marks (non-blocking)
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().slice(0, 10);

    // Fire-and-forget notification dispatch
    Promise.all(
      results.map(async ({ studentId, status }) => {
        try {
          if (status === "ABSENT") {
            const already = await db.notification.findFirst({
              where: {
                targetStudentId: studentId,
                type: canonicalNotificationType("ATTENDANCE_ABSENT"),
                createdAt: { gte: dayStart },
              },
              select: { id: true },
            }).catch(() => null);

            if (!already) {
              const built = notifyMessages.attendanceAbsent(dateStr);
              await dispatchNotification(db, {
                event: "ATTENDANCE_ABSENT",
                actor: { id: auth.user.id, role: auth.user.role },
                audience: { kind: "INDIVIDUAL", studentId },
                title: built.title,
                message: built.message,
                templateKey: "ATTENDANCE_ABSENT",
                vars: { testDate: dateStr },
                internal: true,
                idempotencyKey: `ATTENDANCE_ABSENT:${studentId}:${dateStr}`,
              });
            }
          } else {
            const already = await db.notification.findFirst({
              where: {
                targetStudentId: studentId,
                type: canonicalNotificationType("ATTENDANCE_MARKED"),
                createdAt: { gte: dayStart },
              },
              select: { id: true },
            }).catch(() => null);

            if (!already) {
              const built = notifyMessages.attendanceMarked(dateStr, status);
              await dispatchNotification(db, {
                event: "ATTENDANCE_MARKED",
                actor: { id: auth.user.id, role: auth.user.role },
                audience: { kind: "INDIVIDUAL", studentId },
                title: built.title,
                message: built.message,
                templateKey: "ATTENDANCE_MARKED",
                vars: { testDate: dateStr },
                channels: ["IN_APP"],
                internal: true,
                idempotencyKey: `ATTENDANCE_MARKED:${studentId}:${dateStr}`,
              });
            }
          }
        } catch {
          // Never fail attendance write due to notification issues
        }
      })
    ).catch(() => {});

    return ok({ saved: results.length }, 201);
  } catch (err) {
    return serverError("attendance:bulk", err);
  }
}