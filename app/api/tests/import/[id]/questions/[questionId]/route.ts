// Phase 12 — edit one imported candidate (stays PENDING until approved).
// Faculty scope: only their own import's staging test.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { importScope } from "@/lib/importScope";

export const dynamic = "force-dynamic";

const LETTERS = ["A", "B", "C", "D", "E"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { id, questionId } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Editing imported question");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const scope = await importScope(db, auth.user.role, auth.user.id, id);
    if (!scope.ok) return fail(scope.error ?? "Forbidden.", scope.status ?? 403);
    const existing = await db.question.findUnique({ where: { id: questionId } });
    if (!existing || existing.testId !== scope.stagingTestId) {
      return fail("Question not found in this import.", 404);
    }
    const answer = body.correctAnswer;
    const row = await db.question.update({
      where: { id: questionId },
      data: {
        ...(typeof body.questionText === "string" && body.questionText.trim() ? { questionText: body.questionText.trim() } : {}),
        ...(typeof body.optionA === "string" ? { optionA: body.optionA } : {}),
        ...(typeof body.optionB === "string" ? { optionB: body.optionB } : {}),
        ...(typeof body.optionC === "string" ? { optionC: body.optionC } : {}),
        ...(typeof body.optionD === "string" ? { optionD: body.optionD } : {}),
        ...(typeof body.optionE === "string" ? { optionE: body.optionE } : {}),
        ...(typeof answer === "string" && LETTERS.includes(answer as (typeof LETTERS)[number])
          ? { correctAnswer: answer }
          : answer === null
            ? { correctAnswer: null }
            : {}),
        ...(typeof body.marks === "number" && body.marks > 0 ? { marks: body.marks } : {}),
        ...(typeof body.negativeMarks === "number" && body.negativeMarks >= 0 ? { negativeMarks: body.negativeMarks } : {}),
        ...(typeof body.explanation === "string" ? { explanation: body.explanation } : {}),
        ...(typeof body.subject === "string" ? { subject: body.subject.slice(0, 60) } : {}),
        ...(typeof body.order === "number" ? { order: body.order } : {}),
      },
    });
    return ok({ item: row });
  } catch (err) {
    return serverError("tests:import-edit", err);
  }
}
