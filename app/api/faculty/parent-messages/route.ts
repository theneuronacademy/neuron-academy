// Faculty Parent Messages API - 1:1 parent communication
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

const CHANNELS = ["SMS", "EMAIL", "IN_APP"] as const;

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading parent messages");

  try {
    const params = new URL(req.url).searchParams;
    const studentId = params.get("studentId");

    let where: Record<string, unknown> = {};

    if (studentId) {
      // Verify faculty has access to this student
      if (auth.user.role === "FACULTY") {
        const student = await db.student.findUnique({
          where: { id: studentId },
          select: { id: true, batchId: true },
        });

        if (!student) return fail("Student not found.", 404);

        const allowed = await facultyBatchIds(db, auth.user.id);
        if (!student.batchId || !allowed.includes(student.batchId)) {
          return fail("Forbidden: student not in your assigned batches.", 403);
        }
      }
      where.studentId = studentId;
    } else if (auth.user.role === "FACULTY") {
      // Get all messages for students in faculty's batches
      const allowed = await facultyBatchIds(db, auth.user.id);
      const students = await db.student.findMany({
        where: { batchId: { in: allowed.length ? allowed : ["__none__"] } },
        select: { id: true },
      });
      where.studentId = { in: students.map((s) => s.id) };
    }

    const messages = await db.parentMessage.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, studentId: true, parentName: true, parentMobile: true } },
      },
      orderBy: { sentAt: "desc" },
      take: 200,
    });

    return ok({ items: messages, source: "database" });
  } catch (err) {
    return serverError("parent-messages:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Sending parent message");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const missing = missingFields(body, ["studentId", "subject", "message", "channel"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);

  const { studentId, subject, message, channel } = body;

  if (!CHANNELS.includes(channel as (typeof CHANNELS)[number])) {
    return fail(`Invalid channel. Must be one of: ${CHANNELS.join(", ")}`, 400);
  }

  // Verify student exists and faculty has access
  const student = await db.student.findUnique({
    where: { id: String(studentId) },
    select: { id: true, batchId: true, parentName: true, parentMobile: true },
  });

  if (!student) return fail("Student not found.", 404);

  if (auth.user.role === "FACULTY") {
    const allowed = await facultyBatchIds(db, auth.user.id);
    if (!student.batchId || !allowed.includes(student.batchId)) {
      return fail("Forbidden: student not in your assigned batches.", 403);
    }
  }

  try {
    const parentMessage = await db.parentMessage.create({
      data: {
        studentId: String(studentId),
        subject: String(subject),
        message: String(message),
        channel: channel as (typeof CHANNELS)[number],
        status: "SENT",
      },
      include: {
        student: { select: { id: true, name: true, studentId: true, parentName: true, parentMobile: true } },
      },
    });

    // TODO: Actually send via SMS/EMAIL provider based on channel
    // For now, just log as SENT
    // In production: integrate with MSG91 for SMS, email service for EMAIL

    return ok({ item: parentMessage }, 201);
  } catch (err) {
    return serverError("parent-messages:create", err);
  }
}