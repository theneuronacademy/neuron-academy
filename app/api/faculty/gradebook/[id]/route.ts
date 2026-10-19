// Faculty Gradebook API - Calculate and return gradebook entries
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
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

interface GradebookEntry {
  studentId: string;
  studentName: string;
  categoryScores: Record<string, number>; // categoryId -> average percentage
  finalGrade: number;
  letterGrade: string;
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
  if (!db) return dbNotConfigured("Reading gradebook");

  const { id } = await params; // batchId

  try {
    // Verify faculty access
    if (auth.user.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (!allowed.includes(id)) return fail("Forbidden: batch not assigned to you.", 403);
    }

    // Get batch students
    const students = await db.student.findMany({
      where: { batchId: id, status: "ACTIVE" },
      select: { id: true, name: true, studentId: true },
      orderBy: { name: "asc" },
    });

    if (students.length === 0) {
      return ok({ entries: [], source: "database" });
    }

    // Get gradebook config
    const config = await db.gradebookConfig.findUnique({
      where: { batchId: id },
      select: { categories: true },
    });

    const categories = (config?.categories as unknown as Category[]) ?? [
      { id: "attendance", name: "Attendance", weight: 15, color: "#10B981" },
      { id: "assignments", name: "Assignments", weight: 25, color: "#3B82F6" },
      { id: "tests", name: "Tests", weight: 40, color: "#8B5CF6" },
      { id: "participation", name: "Participation", weight: 20, color: "#F59E0B" },
    ];

    // Fetch all data needed for calculations
    const studentIds = students.map((s) => s.id);

    // Attendance data
    const attendanceAgg = await db.attendance.groupBy({
      by: ["studentId", "status"],
      where: { studentId: { in: studentIds } },
      _count: { status: true },
    });

    // Test results
    const testResults = await db.result.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, percentage: true, testId: true },
    });

    // Assignment submissions (graded)
    const submissions = await db.submission.findMany({
      where: {
        studentId: { in: studentIds },
        status: "GRADED",
        marks: { not: null },
        assignment: { batchId: id },
      },
      include: { assignment: { select: { maxMarks: true } } },
    });

    // Build per-student aggregates
    const perStudent = new Map<string, { attendance: { present: number; total: number }; testScores: number[]; assignmentScores: number[] }>();

    for (const s of students) {
      perStudent.set(s.id, { attendance: { present: 0, total: 0 }, testScores: [], assignmentScores: [] });
    }

    // Process attendance
    for (const a of attendanceAgg) {
      const cur = perStudent.get(a.studentId);
      if (!cur) continue;
      cur.attendance.total += a._count.status;
      if (a.status === "PRESENT" || a.status === "LATE") cur.attendance.present += a._count.status;
    }

    // Process test results
    for (const r of testResults) {
      const cur = perStudent.get(r.studentId);
      if (cur) cur.testScores.push(r.percentage ?? 0);
    }

    // Process assignment submissions
    for (const s of submissions) {
      const cur = perStudent.get(s.studentId);
      if (cur && s.marks !== null && s.assignment.maxMarks > 0) {
        cur.assignmentScores.push((s.marks / s.assignment.maxMarks) * 100);
      }
    }

    // Calculate gradebook entries
    const entries: GradebookEntry[] = students.map((student) => {
      const data = perStudent.get(student.id) ?? { attendance: { present: 0, total: 0 }, testScores: [], assignmentScores: [] };

      const categoryScores: Record<string, number> = {};

      // Attendance score
      const attendancePct = data.attendance.total > 0
        ? (data.attendance.present / data.attendance.total) * 100
        : 0;
      categoryScores.attendance = Math.round(attendancePct * 10) / 10;

      // Assignments score
      const assignmentAvg = data.assignmentScores.length > 0
        ? data.assignmentScores.reduce((a, b) => a + b, 0) / data.assignmentScores.length
        : 0;
      categoryScores.assignments = Math.round(assignmentAvg * 10) / 10;

      // Tests score
      const testAvg = data.testScores.length > 0
        ? data.testScores.reduce((a, b) => a + b, 0) / data.testScores.length
        : 0;
      categoryScores.tests = Math.round(testAvg * 10) / 10;

      // Participation (placeholder - could be expanded)
      categoryScores.participation = 0;

      // Calculate weighted final grade
      let finalGrade = 0;
      for (const cat of categories) {
        finalGrade += (categoryScores[cat.id] ?? 0) * (cat.weight / 100);
      }

      return {
        studentId: student.id,
        studentName: student.name,
        categoryScores,
        finalGrade: Math.round(finalGrade * 10) / 10,
        letterGrade: calculateLetterGrade(finalGrade),
      };
    });

    return ok({ entries, categories, source: "database" });
  } catch (err) {
    return serverError("gradebook:get", err);
  }
}