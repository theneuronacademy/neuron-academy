// Own revision bookmarks (STUDENT only — personal "revise later" list).
// GET  /api/bookmarks — own bookmarks, newest first (bounded 200).
// POST /api/bookmarks — { testId, questionId, note? } (note ≤ 280 chars).
// DELETE /api/bookmarks?questionId= — remove own bookmark.
// Ownership is session-derived; question must belong to the given test
// (prevents cross-test ID forgery). Scores/attempts untouched.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { getScopedStudent } from "@/lib/studentScope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT") return fail("Forbidden.", 403);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading bookmarks");
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    if (!scoped) return fail("Student profile not found.", 403);
    const rows = await db.bookmark.findMany({
      where: { studentId: scoped.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        test: { select: { id: true, title: true } },
        question: {
          select: { id: true, questionText: true, correctAnswer: true, explanation: true, marks: true, subject: true },
        },
      },
    });
    return ok({ items: rows, source: "database" });
  } catch {
    // Pre-migration database: honest empty instead of 500.
    return ok({ items: [], source: "unavailable" });
  }
}

export async function POST(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT") return fail("Forbidden.", 403);
  const db = getDb();
  if (!db) return dbNotConfigured("Saving bookmark");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const testId = typeof body.testId === "string" ? body.testId.trim() : "";
  const questionId = typeof body.questionId === "string" ? body.questionId.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 280) : null;
  if (!testId || !questionId) return fail("testId and questionId are required.", 400);
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    if (!scoped) return fail("Student profile not found.", 403);
    const q = await db.question.findFirst({ where: { id: questionId, testId }, select: { id: true } });
    if (!q) return fail("Question not found in this test.", 404);
    const created = await db.bookmark.upsert({
      where: { studentId_questionId: { studentId: scoped.id, questionId } },
      update: { note },
      create: { studentId: scoped.id, testId, questionId, note },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("bookmarks:create", err);
  }
}

export async function DELETE(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT") return fail("Forbidden.", 403);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting bookmark");
  const questionId = new URL(req.url).searchParams.get("questionId") ?? "";
  if (!questionId.trim()) return fail("questionId is required.", 400);
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    if (!scoped) return fail("Student profile not found.", 403);
    await db.bookmark.deleteMany({ where: { studentId: scoped.id, questionId: questionId.trim() } });
    return ok({ deleted: true });
  } catch (err) {
    return serverError("bookmarks:delete", err);
  }
}
