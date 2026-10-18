// Phase 21 — Student Streak & Daily Goal API
// Get and update streak data, daily goal

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { resolveStudent } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Streak data");

  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile) return fail("Student profile not found.", 403);

    const student = await db.student.findUnique({
      where: { id: profile.id },
      select: {
        streakDays: true,
        longestStreak: true,
        dailyGoalMinutes: true,
        lastTestAt: true,
      },
    });

    if (!student) return fail("Student not found.", 404);

    return ok({
      streakDays: student.streakDays,
      longestStreak: student.longestStreak,
      dailyGoalMinutes: student.dailyGoalMinutes,
      lastTestAt: student.lastTestAt?.toISOString() ?? null,
      // Check if tested today
      testedToday: student.lastTestAt ? new Date(student.lastTestAt).toDateString() === new Date().toDateString() : false,
    });
  } catch (err) {
    return serverError("streak:get", err);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Streak update");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile) return fail("Student profile not found.", 403);

    const updates: Record<string, unknown> = {};

    if (typeof body.dailyGoalMinutes === "number" && body.dailyGoalMinutes >= 5 && body.dailyGoalMinutes <= 480) {
      updates.dailyGoalMinutes = body.dailyGoalMinutes;
    }

    const student = await db.student.update({
      where: { id: profile.id },
      data: updates,
      select: {
        streakDays: true,
        longestStreak: true,
        dailyGoalMinutes: true,
        lastTestAt: true,
      },
    });

    return ok({
      streakDays: student.streakDays,
      longestStreak: student.longestStreak,
      dailyGoalMinutes: student.dailyGoalMinutes,
      lastTestAt: student.lastTestAt?.toISOString() ?? null,
      testedToday: student.lastTestAt ? new Date(student.lastTestAt).toDateString() === new Date().toDateString() : false,
    });
  } catch (err) {
    return serverError("streak:update", err);
  }
}