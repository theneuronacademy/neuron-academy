// Doubt replies — faculty/admin answer, asker follows up.
// POST /api/doubts/[id]/replies — { text 1–2000 chars }.
// STUDENT: only own doubts. FACULTY: only assigned-batch doubts (replying
// flips ASKED → ANSWERED). ADMIN: any doubt. Author name is snapshotted
// server-side from the session — never trusted from the client.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { facultyBatchIds, resolveStudent } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT" && viewer.role !== "FACULTY" && viewer.role !== "ADMIN") {
    return fail("Forbidden.", 403);
  }
  const db = getDb();
  if (!db) return dbNotConfigured("Replying to doubt");
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 1 || text.length > 2000) return fail("Reply must be 1–2000 characters.", 400);
  try {
    const doubt = await db.doubt.findUnique({ where: { id }, select: { id: true, studentId: true, batchId: true, status: true } });
    if (!doubt) return fail("Doubt not found.", 404);
    if (doubt.status === "CLOSED") return fail("This doubt is closed.", 409);

    let authorName = viewer.name || viewer.email;
    if (viewer.role === "STUDENT") {
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      if (!profile || doubt.studentId !== profile.id) return fail("Doubt not found.", 404);
      const row = await db.student.findUnique({ where: { id: profile.id }, select: { name: true } });
      if (row) authorName = row.name;
    } else if (viewer.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, viewer.id);
      if (!doubt.batchId || !allowed.includes(doubt.batchId)) return fail("Doubt not found.", 404);
      const f = await db.faculty.findFirst({ where: { userId: viewer.id }, select: { name: true } });
      if (f) authorName = f.name;
    }

    const [reply] = await Promise.all([
      db.doubtReply.create({
        data: { doubtId: id, authorRole: viewer.role, authorUserId: viewer.id, authorName, text },
      }),
      doubt.status === "ASKED" && viewer.role !== "STUDENT"
        ? db.doubt.update({ where: { id }, data: { status: "ANSWERED" } })
        : Promise.resolve(null),
    ]);
    return ok({ item: reply }, 201);
  } catch (err) {
    return serverError("doubts:reply", err);
  }
}
