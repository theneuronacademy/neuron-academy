// Phase 3 — Attendance API (model only; eSSL NOT connected).
// Manual marking foundation; biometric sync is a later phase.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { missingFields, parseDate } from "@/lib/validation";
import { facultyBatchIds } from "@/lib/testAccess";
import { DEMO_ATTENDANCE_OVERVIEW } from "@/data/admin";

export const dynamic = "force-dynamic";

const STATUSES = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;

export async function GET(req: NextRequest) {
  // Attendance records are private — ADMIN/FACULTY only (own-view for students in Phase 5).
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return ok({ overview: DEMO_ATTENDANCE_OVERVIEW, records: [], source: "demo" });
  try {
    const params = new URL(req.url).searchParams;
    const batchId = params.get("batchId");
    const date = params.get("date");
    if (auth.user.role === "FACULTY" && batchId) {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (!allowed.includes(batchId)) return fail("Forbidden: batch not assigned to you.", 403);
    }
    const scopeBatchIds = auth.user.role === "FACULTY" && !batchId ? await facultyBatchIds(db, auth.user.id) : null;
    const rows = await db.attendance.findMany({
      where: {
        ...(batchId ? { batchId } : scopeBatchIds ? { batchId: { in: scopeBatchIds.length ? scopeBatchIds : ["__none__"] } } : {}),
        ...(date && parseDate(date) ? { date: parseDate(date) as Date } : {}),
      },
      include: { student: { select: { id: true, name: true, studentId: true } } },
      orderBy: { date: "desc" },
      take: 500,
    });
    return ok({ records: rows, source: "database" });
  } catch (err) {
    return serverError("attendance:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Marking attendance");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["studentId", "batchId", "date"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  const date = parseDate(body.date);
  if (!date) return fail("Invalid date.", 400);
  try {
    const studentId = String(body.studentId);
    const reqBatchId = String(body.batchId);
    if (auth.user.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (!allowed.includes(reqBatchId)) return fail("Forbidden: batch not assigned to you.", 403);
      const student = await db.student.findUnique({ where: { id: studentId }, select: { id: true, batchId: true } });
      if (!student || !student.batchId || !allowed.includes(student.batchId)) {
        return fail("Forbidden: student not in your assigned batches.", 403);
      }
    }
    const existing = await db.attendance.findUnique({ where: { studentId_date: { studentId, date } } }).catch(() => null);
    if (existing && existing.source === "BIOMETRIC" && auth.user.role === "FACULTY") {
      return fail("Biometric attendance exists for this student/date and cannot be overwritten by manual entry. Contact admin.", 409);
    }
    const row = await db.attendance.upsert({
      where: { studentId_date: { studentId, date } },
      update: {
        status: STATUSES.includes(body.status as (typeof STATUSES)[number]) ? (body.status as (typeof STATUSES)[number]) : "PRESENT",
        source: "MANUAL",
      },
      create: {
        studentId,
        batchId: reqBatchId,
        date,
        status: STATUSES.includes(body.status as (typeof STATUSES)[number]) ? (body.status as (typeof STATUSES)[number]) : "PRESENT",
        source: "MANUAL",
      },
    });
    return ok({ item: row }, 201);
  } catch (err) {
    return serverError("attendance:mark", err);
  }
}
