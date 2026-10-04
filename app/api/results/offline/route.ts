// Phase 5 — Offline marks entry (no student attempt required).
// Workflow: offline test conducted externally → staff enters marks →
// server validates (student/test exist, 0 ≤ marks ≤ totalMarks, test is
// OFFLINE) → percentage computed server-side → result stored → database
// notification for the student. Client percentage is never trusted.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Entering offline marks");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["studentId", "testId"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  if (typeof body.marks !== "number") return fail("Marks must be a number.", 400);
  try {
    const student = await db.student.findUnique({ where: { id: String(body.studentId) } });
    if (!student) return fail("Student not found.", 404);
    const test = await db.test.findUnique({ where: { id: String(body.testId) } });
    if (!test) return fail("Test not found.", 404);
    if (test.type !== "OFFLINE") return fail("Offline marks apply only to OFFLINE tests.", 400);
    // Faculty may enter marks only for own/assigned-batch tests.
    if (auth.user.role === "FACULTY") {
      const allowed = test.createdById === auth.user.id || (test.batchId !== null && (await facultyBatchIds(db, auth.user.id)).includes(test.batchId));
      if (!allowed) return fail("You can enter marks only for your own or assigned-batch tests.", 403);
    }
    const marks = body.marks;
    if (marks < 0 || marks > test.totalMarks) return fail(`Marks must be between 0 and ${test.totalMarks}.`, 400);
    const percentage = test.totalMarks > 0 ? Math.round((marks / test.totalMarks) * 1000) / 10 : 0;
    const existing = await db.result.findFirst({ where: { studentId: student.id, testId: test.id } });
    const result = existing
      ? await db.result.update({ where: { id: existing.id }, data: { marks, totalMarks: test.totalMarks, percentage, status: "PUBLISHED" } })
      : await db.result.create({ data: { studentId: student.id, testId: test.id, marks, totalMarks: test.totalMarks, percentage, status: "PUBLISHED" } });
    try {
      await db.notification.create({
        data: {
          title: "Your result has been released",
          message: `Marks for ${test.title}: ${marks}/${test.totalMarks}.`,
          type: "result",
          audience: "INDIVIDUAL",
          targetStudentId: student.id,
          createdById: auth.user.id,
          sentAt: new Date(),
          status: "SENT",
        },
      });
    } catch {
      /* notification must never fail marks entry */
    }
    return ok({ item: result }, 201);
  } catch (err) {
    return serverError("results:offline", err);
  }
}
