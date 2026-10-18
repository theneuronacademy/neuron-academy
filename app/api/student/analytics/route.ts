// Phase 20 — Student Test Analytics API
// Provides detailed analytics per student: topic performance, time analysis, trends

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { resolveStudent } from "@/lib/testAccess";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Fetching analytics");

  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile) return fail("Student profile not found.", 403);

    const searchParams = req.nextUrl.searchParams;
    const testId = searchParams.get("testId");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

    // Get all results for this student
    const results = await db.result.findMany({
      where: {
        studentId: profile.id,
        ...(testId ? { testId } : {}),
      },
      include: {
        test: {
          select: {
            id: true,
            title: true,
            type: true,
            duration: true,
            totalMarks: true,
            subject: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    if (results.length === 0) {
      return ok({
        summary: null,
        topicPerformance: [],
        timeAnalysis: null,
        trends: [],
        recentResults: [],
      });
    }

    // Calculate summary
    const totalTests = results.length;
    const avgPercentage = results.reduce((sum, r) => sum + (r.percentage ?? 0), 0) / totalTests;
    const bestScore = Math.max(...results.map((r) => r.percentage ?? 0));
    const worstScore = Math.min(...results.map((r) => r.percentage ?? 0));
    const totalMarks = results.reduce((sum, r) => sum + (r.marks ?? 0), 0);
    const maxPossible = results.reduce((sum, r) => sum + (r.totalMarks ?? 0), 0);

    // Aggregate topic breakdown across all results
    const topicMap = new Map<string, { correct: number; total: number; marks: number; maxMarks: number; timeSpent: number }>();
    for (const r of results) {
      if (r.topicBreakdown && typeof r.topicBreakdown === "object") {
        const breakdown = r.topicBreakdown as Record<string, { correct: number; total: number; marks: number; maxMarks: number; timeSpent: number }>;
        for (const [topic, data] of Object.entries(breakdown)) {
          const existing = topicMap.get(topic) || { correct: 0, total: 0, marks: 0, maxMarks: 0, timeSpent: 0 };
          topicMap.set(topic, {
            correct: existing.correct + (data.correct ?? 0),
            total: existing.total + (data.total ?? 0),
            marks: existing.marks + (data.marks ?? 0),
            maxMarks: existing.maxMarks + (data.maxMarks ?? 0),
            timeSpent: existing.timeSpent + (data.timeSpent ?? 0),
          });
        }
      }
    }

    const topicPerformance = Array.from(topicMap.entries())
      .map(([topic, data]) => ({
        topic,
        accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
        marks: data.marks,
        maxMarks: data.maxMarks,
        percentage: data.maxMarks > 0 ? (data.marks / data.maxMarks) * 100 : 0,
        avgTimePerQuestion: data.total > 0 ? data.timeSpent / data.total : 0,
        questionsAttempted: data.total,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Time analysis
    const timePerQuestionMap = new Map<string, number[]>();
    for (const r of results) {
      if (r.timePerQuestion && typeof r.timePerQuestion === "object") {
        const tpq = r.timePerQuestion as Record<string, number>;
        for (const [qId, time] of Object.entries(tpq)) {
          if (!timePerQuestionMap.has(qId)) timePerQuestionMap.set(qId, []);
          timePerQuestionMap.get(qId)!.push(time);
        }
      }
    }

    const avgTimePerQuestion = timePerQuestionMap.size > 0
      ? Array.from(timePerQuestionMap.values()).reduce((sum, arr) => sum + arr.reduce((a, b) => a + b, 0) / arr.length, 0) / timePerQuestionMap.size
      : 0;

    // Trends (last 10 results by date)
    const sortedByDate = [...results].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const trends = sortedByDate.slice(-10).map((r) => ({
      testId: r.testId,
      testTitle: r.test?.title,
      date: r.createdAt,
      percentage: r.percentage,
      marks: r.marks,
      totalMarks: r.totalMarks,
    }));

    // Weak topics (accuracy < 50%)
    const weakTopics = topicPerformance.filter((t) => t.total > 2 && t.accuracy < 50);
    const strongTopics = topicPerformance.filter((t) => t.total > 2 && t.accuracy >= 80);

    return ok({
      summary: {
        totalTests,
        avgPercentage: Math.round(avgPercentage * 10) / 10,
        bestScore: Math.round(bestScore * 10) / 10,
        worstScore: Math.round(worstScore * 10) / 10,
        totalMarks,
        maxPossible,
        overallPercentage: maxPossible > 0 ? Math.round((totalMarks / maxPossible) * 1000) / 10 : 0,
      },
      topicPerformance,
      timeAnalysis: {
        avgTimePerQuestion: Math.round(avgTimePerQuestion * 10) / 10,
        totalQuestionsAnalyzed: timePerQuestionMap.size,
      },
      trends,
      recentResults: results.slice(0, 5).map((r) => ({
        id: r.id,
        testId: r.testId,
        testTitle: r.test?.title,
        testType: r.test?.type,
        marks: r.marks,
        totalMarks: r.totalMarks,
        percentage: r.percentage,
        attempted: r.attempted,
        correct: r.correct,
        wrong: r.wrong,
        date: r.createdAt,
      })),
      weakTopics: weakTopics.slice(0, 5),
      strongTopics: strongTopics.slice(0, 5),
    });
  } catch (err) {
    return fail("Failed to fetch analytics", 500);
  }
}