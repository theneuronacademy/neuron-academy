// Phase 21 — Parent Portal API (Read-Only)
// Parents can view their children's marks, attendance, streak via registered parentMobile

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { normalizePhone } from "@/lib/credentials";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Auth via parent mobile (separate from student session)
  const db = getDb();
  if (!db) return dbNotConfigured("Parent portal");

  const params = new URL(req.url).searchParams;
  const phone = normalizePhone(params.get("phone"));
  if (!phone) return fail("Parent mobile number required.", 400);

  try {
    // Find students linked to this parent mobile
    const students = await db.student.findMany({
      where: { parentMobile: phone, status: "ACTIVE" },
      select: {
        id: true,
        studentId: true,
        name: true,
        batch: { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
        streakDays: true,
        longestStreak: true,
        dailyGoalMinutes: true,
        lastTestAt: true,
      },
    });

    if (students.length === 0) {
      return ok({ students: [], message: "No active students found for this mobile number." });
    }

    // Get each student's marks summary and attendance
    const results = await Promise.all(
      students.map(async (s) => {
        const results = await db.result.findMany({
          where: { studentId: s.id },
          include: { test: { select: { id: true, title: true, type: true, totalMarks: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        const attendance = await db.attendance.findMany({
          where: { studentId: s.id },
          orderBy: { date: "desc" },
          take: 30,
        });

        const attended = attendance.filter((a) => a.status === "PRESENT").length;
        const total = attendance.length;
        const attendancePct = total > 0 ? Math.round((attended / total) * 100) : null;

        return {
          student: s,
          recentResults: results.map((r) => ({
            id: r.id,
            testId: r.testId,
            testTitle: r.test?.title,
            testType: r.test?.type,
            marks: r.marks,
            totalMarks: r.totalMarks,
            percentage: r.percentage,
            date: r.createdAt.toISOString().slice(0, 10),
          })),
          attendance: {
            percentage: attendancePct,
            attended,
            total,
            recent: attendance.slice(0, 5).map((a) => ({
              date: a.date.toISOString().slice(0, 10),
              status: a.status,
            })),
          },
          streak: {
            current: s.streakDays,
            longest: s.longestStreak,
            goal: s.dailyGoalMinutes,
            lastTestAt: s.lastTestAt?.toISOString() ?? null,
          },
        };
      }),
    );

    return ok({ students: results });
  } catch (err) {
    return serverError("parent:students", err);
  }
}