// Faculty Assignment Submissions API - List submissions for an assignment
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading submissions");

  const { id } = await params;

  try {
    const assignment = await db.assignment.findUnique({
      where: { id },
      select: { id: true, batchId: true },
    });

    if (!assignment) return fail("Assignment not found.", 404);

    // Verify faculty access
    if (auth.user.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (!allowed.includes(assignment.batchId)) return fail("Forbidden: assignment not in your assigned batches.", 403);
    }

    const submissions = await db.submission.findMany({
      where: { assignmentId: id },
      include: {
        student: { select: { id: true, name: true, studentId: true } },
      },
      orderBy: { submittedAt: "asc" },
    });

    return ok({ items: submissions, source: "database" });
  } catch (err) {
    return serverError("assignments:submissions", err);
  }
}