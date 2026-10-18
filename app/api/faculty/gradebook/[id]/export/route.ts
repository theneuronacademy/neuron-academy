// Faculty Gradebook Export API - Export gradebook as CSV or PDF
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

interface Category {
  id: string;
  name: string;
  weight: number;
  color: string;
}

function calculateLetterGrade(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 85) return "A";
  if (percentage >= 80) return "A-";
  if (percentage >= 75) return "B+";
  if (percentage >= 70) return "B";
  if (percentage >= 65) return "B-";
  if (percentage >= 60) return "C+";
  if (percentage >= 55) return "C";
  if (percentage >= 50) return "C-";
  return "F";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Exporting gradebook");

  const { id } = await params; // batchId
  const format = new URL(req.url).searchParams.get("format") ?? "csv";

  try {
    // Verify faculty access
    if (auth.user.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (!allowed.includes(id)) return fail("Forbidden: batch not assigned to you.", 403);
    }

    // Get batch info
    const batch = await db.batch.findUnique({
      where: { id },
      select: { id: true, name: true, course: { select: { name: true } } },
    });

    if (!batch) return fail("Batch not found.", 404);

    // Get gradebook config
    const config = await db.gradebookConfig.findUnique({
      where: { batchId: id },
      select: { categories: true },
    });

    const categories = (config?.categories as Category[]) ?? [
      { id: "attendance", name: "Attendance", weight: 15, color: "#10B981" },
      { id: "assignments", name: "Assignments", weight: 25, color: "#3B82F6" },
      { id: "tests", name: "Tests", weight: 40, color: "#8B5CF6" },
      { id: "participation", name: "Participation", weight: 20, color: "#F59E0B" },
    ];

    // Get students
    const students = await db.student.findMany({
      where: { batchId: id, status: "ACTIVE" },
      select: { id: true, name: true, studentId: true },
      orderBy: { name: "asc" },
    });

    const studentIds = students.map((s) => s.id);

    // Fetch all data
    const [attendanceAgg, testResults, submissions] = await Promise.all([
      db.attendance.groupBy({
        by: ["studentId", "status"],
        where: { studentId: { in: studentIds } },
        _count: { status: true },
      }),
      db.result.findMany({
        where: { studentId: { in: studentIds } },
        select: { studentId: true, percentage: true, testId: true },
      }),
      db.submission.findMany({
        where: {
          studentId: { in: studentIds },
          status: "GRADED",
          marks: { not: null },
          assignment: { batchId: id },
        },
        include: { assignment: { select: { maxMarks: true } } },
      }),
    ]);

    // Build per-student aggregates
    const perStudent = new Map<string, { attendance: { present: number; total: number }; testScores: number[]; assignmentScores: number[] }>();

    for (const s of students) {
      perStudent.set(s.id, { attendance: { present: 0, total: 0 }, testScores: [], assignmentScores: [] });
    }

    for (const a of attendanceAgg) {
      const cur = perStudent.get(a.studentId);
      if (!cur) continue;
      cur.attendance.total += a._count.status;
      if (a.status === "PRESENT" || a.status === "LATE") cur.attendance.present += a._count.status;
    }

    for (const r of testResults) {
      const cur = perStudent.get(r.studentId);
      if (cur) cur.testScores.push(r.percentage ?? 0);
    }

    for (const s of submissions) {
      const cur = perStudent.get(s.studentId);
      if (cur && s.marks !== null && s.assignment.maxMarks > 0) {
        cur.assignmentScores.push((s.marks / s.assignment.maxMarks) * 100);
      }
    }

    // Build rows
    const rows = students.map((student) => {
      const data = perStudent.get(student.id) ?? { attendance: { present: 0, total: 0 }, testScores: [], assignmentScores: [] };

      const categoryScores: Record<string, number> = {};

      const attendancePct = data.attendance.total > 0
        ? (data.attendance.present / data.attendance.total) * 100
        : 0;
      categoryScores.attendance = Math.round(attendancePct * 10) / 10;

      const assignmentAvg = data.assignmentScores.length > 0
        ? data.assignmentScores.reduce((a, b) => a + b, 0) / data.assignmentScores.length
        : 0;
      categoryScores.assignments = Math.round(assignmentAvg * 10) / 10;

      const testAvg = data.testScores.length > 0
        ? data.testScores.reduce((a, b) => a + b, 0) / data.testScores.length
        : 0;
      categoryScores.tests = Math.round(testAvg * 10) / 10;

      categoryScores.participation = 0;

      let finalGrade = 0;
      for (const cat of categories) {
        finalGrade += (categoryScores[cat.id] ?? 0) * (cat.weight / 100);
      }

      return {
        studentId: student.studentId,
        studentName: student.name,
        ...categoryScores,
        finalGrade: Math.round(finalGrade * 10) / 10,
        letterGrade: calculateLetterGrade(finalGrade),
      };
    });

    if (format === "csv") {
      // Generate CSV
      const headers = [
        "Student ID",
        "Student Name",
        ...categories.map((c) => c.name),
        "Final Grade",
        "Letter Grade",
      ];

      const csvRows = [
        headers.join(","),
        ...rows.map((r) =>
          [
            r.studentId,
            `"${r.studentName}"`,
            ...categories.map((c) => r[c.id] ?? 0),
            r.finalGrade,
            r.letterGrade,
          ].join(",")
        ),
      ];

      const csv = csvRows.join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="gradebook-${batch.name}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // For PDF, return JSON (PDF generation would need a library like pdfkit)
    // This is a placeholder - in production you'd use a PDF library
    return fail("PDF export not implemented. Use CSV format.", 501);
  } catch (err) {
    return serverError("gradebook:export", err);
  }
}