// Faculty Grade Submission API - Grade a student submission
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Grading submission");

  const { id } = await params; // submission ID

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const missing = missingFields(body, ["marks"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);

  const { marks, feedback } = body;

  try {
    const submission = await db.submission.findUnique({
      where: { id },
      include: { assignment: { select: { id: true, batchId: true, maxMarks: true } } },
    });

    if (!submission) return fail("Submission not found.", 404);

    // Verify faculty access
    if (auth.user.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (!allowed.includes(submission.assignment.batchId)) return fail("Forbidden: submission not in your assigned batches.", 403);
    }

    // Validate marks
    const marksNum = Number(marks);
    if (isNaN(marksNum) || marksNum < 0 || marksNum > submission.assignment.maxMarks) {
      return fail(`Marks must be between 0 and ${submission.assignment.maxMarks}.`, 400);
    }

    const updated = await db.submission.update({
      where: { id },
      data: {
        marks: marksNum,
        feedback: feedback ? String(feedback) : null,
        status: "GRADED",
      },
      include: {
        student: { select: { id: true, name: true, studentId: true } },
        assignment: { select: { id: true, title: true, batchId: true } },
      },
    });

    return ok({ item: updated });
  } catch (err) {
    return serverError("assignments:grade", err);
  }
}