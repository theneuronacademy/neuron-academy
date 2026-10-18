// Attendance History API - Scoped to student + month for heatmap
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading attendance history");

  try {
    const params = new URL(req.url).searchParams;
    const batchId = params.get("batchId");
    const studentId = params.get("studentId");
    const month = params.get("month"); // YYYY-MM

    if (!batchId || !studentId || !month) {
      return fail("Missing required parameters: batchId, studentId, month.", 400);
    }

    // Verify faculty access
    if (auth.user.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (!allowed.includes(batchId)) return fail("Forbidden: batch not assigned to you.", 403);

      const student = await db.student.findUnique({
        where: { id: studentId },
        select: { id: true, batchId: true },
      });

      if (!student || student.batchId !== batchId) {
        return fail("Forbidden: student not in your assigned batch.", 403);
      }
    }

    // Parse month boundaries
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    const records = await db.attendance.findMany({
      where: {
        studentId,
        batchId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
      select: {
        studentId: true,
        status: true,
        date: true,
        source: true,
      },
    });

    return ok({ records, source: "database" });
  } catch (err) {
    return serverError("attendance:history", err);
  }
}