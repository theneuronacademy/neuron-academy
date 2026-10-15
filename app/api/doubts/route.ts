// Doubt-solving Q&A.
// GET  /api/doubts — STUDENT: own doubts; FACULTY: assigned-batch doubts
//   (?status=ASKED|ANSWERED|CLOSED); ADMIN: all (?batchId=, ?status=).
// POST /api/doubts — STUDENT: { subject?, questionText 10–2000 chars }.
// Replies live at POST /api/doubts/[id]/replies; close at PATCH /api/doubts/[id].

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds, resolveStudent } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

const STATUSES = ["ASKED", "ANSWERED", "CLOSED"] as const;

export async function GET(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading doubts");
  try {
    const q = new URL(req.url).searchParams;
    const status = (q.get("status") ?? "").toUpperCase();
    const statusFilter = (STATUSES as readonly string[]).includes(status) ? { status: status as (typeof STATUSES)[number] } : {};
    if (viewer.role === "STUDENT") {
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      if (!profile) return fail("Student profile not found.", 403);
      const items = await db.doubt.findMany({
        where: { studentId: profile.id, ...statusFilter },
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: { replies: { orderBy: { createdAt: "asc" } }, student: { select: { name: true } } },
      });
      return ok({ items, source: "database" });
    }
    if (viewer.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, viewer.id);
      const items = await db.doubt.findMany({
        where: { batchId: { in: allowed.length ? allowed : ["__none__"] }, ...statusFilter },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: 200,
        include: { replies: { orderBy: { createdAt: "asc" } }, student: { select: { name: true } } },
      });
      return ok({ items, source: "database" });
    }
    if (viewer.role !== "ADMIN") return fail("Forbidden.", 403);
    const batchId = q.get("batchId") ?? "";
    const items = await db.doubt.findMany({
      where: { ...(batchId ? { batchId } : {}), ...statusFilter },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: { replies: { orderBy: { createdAt: "asc" } }, student: { select: { name: true } } },
    });
    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("doubts:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Asking doubt");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const questionText = typeof body.questionText === "string" ? body.questionText.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 80) : null;
  if (questionText.length < 10 || questionText.length > 2000) {
    return fail("Question must be 10–2000 characters.", 400);
  }
  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile) return fail("Student profile not found.", 403);
    const created = await db.doubt.create({
      data: { studentId: profile.id, batchId: profile.batchId, subject, questionText },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("doubts:create", err);
  }
}

export async function PATCH(req: NextRequest) {
  // Close/reopen own doubt (STUDENT) — status only, never content rewrite.
  const auth = requireApiRole(req, ["STUDENT"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating doubt");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  if (!id) return fail("id is required.", 400);
  if (status !== "CLOSED" && status !== "ASKED") return fail("status must be CLOSED or ASKED.", 400);
  try {
    const profile = await resolveStudent(db, auth.user.id, auth.user.email);
    if (!profile) return fail("Student profile not found.", 403);
    const existing = await db.doubt.findFirst({ where: { id, studentId: profile.id }, select: { id: true } });
    if (!existing) return fail("Doubt not found.", 404);
    const item = await db.doubt.update({ where: { id }, data: { status: status as "CLOSED" | "ASKED" } });
    return ok({ item });
  } catch (err) {
    return serverError("doubts:update", err);
  }
}
