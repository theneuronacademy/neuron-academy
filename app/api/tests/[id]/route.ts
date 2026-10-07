// Phase 5 — Test detail API.
// GET: ADMIN/FACULTY full; STUDENT only own-batch visible tests (no drafts).
// PATCH publish → database notification ("New test available").

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";
import { batchAllowed, canStudentAccessTest, facultyBatchIds, normalizeAccessFields, resolveStudent, STUDENT_VISIBLE_STATUSES, validateAccessFields } from "@/lib/testAccess";
import { parseDate } from "@/lib/validation";
import { safeNotify, notifyMessages } from "@/lib/notify";

export const dynamic = "force-dynamic";

async function facultyMayEdit(db: NonNullable<ReturnType<typeof getDb>>, userId: string, testId: string): Promise<boolean> {
  const t = await db.test.findUnique({ where: { id: testId }, select: { createdById: true, batchId: true } });
  if (!t) return true; // let the update itself 404
  if (t.createdById === userId) return true;
  if (t.batchId) {
    const allowed = await facultyBatchIds(db, userId);
    if (allowed.includes(t.batchId)) return true;
  }
  return false;
}

/** Phase 12 — publish gate. Returns actionable issues (empty = publishable). */
async function validatePublishable(
  db: NonNullable<ReturnType<typeof getDb>>,
  testId: string,
  patch: Record<string, unknown>
): Promise<string[]> {
  const issues: string[] = [];
  const test = await db.test.findUnique({
    where: { id: testId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!test) return ["Test not found."];
  const batchId = typeof patch.batchId === "string" ? patch.batchId || null : test.batchId;
  if (!batchId) issues.push("Assign a batch before publishing.");
  const duration = typeof patch.duration === "number" ? patch.duration : test.duration;
  if (!(duration > 0)) issues.push("Set a positive duration (minutes).");
  if (test.questions.length === 0) {
    issues.push("Add at least one question before publishing.");
    return issues;
  }
  const seen = new Set<string>();
  test.questions.forEach((q, i) => {
    const n = i + 1;
    const key = `${q.questionText.trim().toLowerCase()}|${[q.optionA, q.optionB, q.optionC, q.optionD, q.optionE].join("|")}`;
    if (seen.has(key)) issues.push(`Q${n} is a duplicate.`);
    seen.add(key);
    const opts = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE].filter(
      (o) => typeof o === "string" && o.trim()
    );
    if (opts.length < 2) issues.push(`Q${n} needs at least 2 non-empty options.`);
    if (!q.correctAnswer) {
      issues.push(`Q${n} has no correct answer — set it before publishing a scored test.`);
    } else if (!["A", "B", "C", "D", "E"].includes(q.correctAnswer.toUpperCase())) {
      issues.push(`Q${n} has an invalid correct answer.`);
    } else if (q.correctAnswer.toUpperCase() !== q.correctAnswer) {
      issues.push(`Q${n} answer must be a capital letter A–E.`);
    } else {
      const idx = "ABCDE".indexOf(q.correctAnswer);
      const optTexts = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE];
      if (!optTexts[idx] || !String(optTexts[idx]).trim()) {
        issues.push(`Q${n} answer ${q.correctAnswer} has empty option text.`);
      }
    }
    if (!(q.marks > 0)) issues.push(`Q${n} needs positive marks.`);
  });
  return issues;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a test");
  // Phase 16 — authenticate before touching the database so anonymous
  // callers always get a uniform 401 (no id-existence oracle via 404/401).
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  try {
    const row = await db.test.findUnique({ where: { id }, include: { questions: { orderBy: { order: "asc" } }, batch: true } });
    if (!row) return fail("Test not found.", 404);
    if (viewer?.role === "STUDENT") {
      if (!STUDENT_VISIBLE_STATUSES.includes(row.status as (typeof STUDENT_VISIBLE_STATUSES)[number])) {
        return fail("Test not found.", 404);
      }
      const profile = await resolveStudent(db, viewer.id, viewer.email);
      // Phase 14 — SCHOLARSHIP bypass for FREE tests (central gate re-checks).
      const freeBypass = !!profile && profile.studentType === "SCHOLARSHIP" && row.accessType === "FREE";
      if (!profile || profile.status !== "ACTIVE" || (!freeBypass && !batchAllowed(profile.batchId, row.batchId))) {
        return fail("Test not found.", 404);
      }
      // Phase 13 — centralized FREE/PAID/PRIVATE gate. Locked tests never
      // reach question data; authorized tests get answer keys stripped.
      const decision = await canStudentAccessTest(db, profile.id, row.id);
      if (!decision.allowed) return fail(decision.reason, decision.http);
      const { questions: fullQuestions, ...meta } = row;
      const safeQuestions = fullQuestions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        optionE: q.optionE,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        order: q.order,
        subject: q.subject,
      }));
      return ok({ item: { ...meta, questions: safeQuestions } });
    }
    // P0: full rows include question data + answer keys — staff only.
    // Anonymous callers are rejected above (401) before any DB lookup.
    // STUDENT is handled above; any other non-staff role is forbidden (403).
    if (viewer.role !== "ADMIN" && viewer.role !== "FACULTY") return fail("Forbidden.", 403);
    return ok({ item: row });
  } catch (err) {
    return serverError("tests:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a test");
  if (auth.user.role === "FACULTY" && !(await facultyMayEdit(db, auth.user.id, id))) {
    return fail("You can edit only your own or assigned-batch tests.", 403);
  }
  if (!db) return dbNotConfigured("Updating a test");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  // Phase 13 — only ADMIN may change access type / price / active flag.
  if (auth.user.role !== "ADMIN" && (body.accessType !== undefined || body.price !== undefined || body.isActive !== undefined)) {
    return fail("Only admins can change test access type, price, or active state.", 403);
  }
  if (body.accessType !== undefined || body.price !== undefined) {
    const accessErr = validateAccessFields(body.accessType, body.price);
    if (accessErr) return fail(accessErr, 400);
  }
  const touchesAccess = auth.user.role === "ADMIN" && (body.accessType !== undefined || body.price !== undefined);
  try {
    // Phase 12 — publish safety: a scored test must be complete and sane.
    if (body.status === "PUBLISHED") {
      const issues = await validatePublishable(db, id, body);
      if (issues.length > 0) return fail(`Cannot publish: ${issues.join(" ")}`, 400);
    }
    // When only one of accessType/price is patched, keep the other from DB.
    let accessData: { accessType?: "FREE" | "PAID" | "PRIVATE"; price?: number } = {};
    if (touchesAccess) {
      if (body.accessType !== undefined && body.price !== undefined) {
        accessData = normalizeAccessFields(body.accessType, body.price);
      } else {
        const existing = await db.test.findUnique({ where: { id }, select: { accessType: true, price: true } });
        if (!existing) return fail("Test not found.", 404);
        const merged = normalizeAccessFields(
          body.accessType !== undefined ? body.accessType : existing.accessType,
          body.price !== undefined ? body.price : existing.price
        );
        const err = validateAccessFields(merged.accessType, merged.price);
        if (err) return fail(err, 400);
        accessData = merged;
      }
    }
    // Phase 15 — publish deduplication: notify only on transition INTO
    // PUBLISHED, never on repeated PATCH calls that leave status unchanged.
    const previous = body.status === "PUBLISHED"
      ? await db.test.findUnique({ where: { id }, select: { status: true } }).catch(() => null)
      : null;
    const row = await db.test.update({
      where: { id },
      data: {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(typeof body.batchId === "string" ? { batchId: body.batchId || null } : {}),
        ...(body.type === "LIVE" || body.type === "OFFLINE" || body.type === "PRACTICE" ? { type: body.type } : {}),
        ...(typeof body.duration === "number" ? { duration: body.duration } : {}),
        ...(typeof body.totalMarks === "number" ? { totalMarks: body.totalMarks } : {}),
        ...(body.startTime !== undefined ? { startTime: parseDate(body.startTime) ?? null } : {}),
        ...(body.endTime !== undefined ? { endTime: parseDate(body.endTime) ?? null } : {}),
        ...(body.status === "DRAFT" || body.status === "SCHEDULED" || body.status === "LIVE" || body.status === "COMPLETED" || body.status === "PUBLISHED"
          ? { status: body.status }
          : {}),
        ...(body.questionOrder === "SERIAL" || body.questionOrder === "RANDOM" ? { questionOrder: body.questionOrder } : {}),
        ...(body.optionOrder === "SERIAL" || body.optionOrder === "RANDOM" ? { optionOrder: body.optionOrder } : {}),
        ...accessData,
        ...(typeof body.isActive === "boolean" && auth.user.role === "ADMIN" ? { isActive: body.isActive } : {}),
        ...(body.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
      },
    });
    // Publish → notify eligible students, but ONLY for FREE tests so paid
    // and private tests are never broadcast. Never fails publishing.
    if (body.status === "PUBLISHED" && row.accessType === "FREE" && previous?.status !== "PUBLISHED") {
      const msg = notifyMessages.freeTestPublished(row.title);
      await safeNotify(db, {
        ...msg,
        audience: row.batchId ? "BATCH" : "ALL_STUDENTS",
        targetBatchId: row.batchId ?? undefined,
        testId: row.id,
        createdById: auth.user.id,
      });
    }
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Test not found.", 404);
    return serverError("tests:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a test");
  if (auth.user.role === "FACULTY" && !(await facultyMayEdit(db, auth.user.id, id))) {
    return fail("You can delete only your own or assigned-batch tests.", 403);
  }
  try {
    await db.test.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Test not found.", 404);
    return serverError("tests:delete", err);
  }
}
