// Results-showcase item API (ADMIN-only writes).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { activationAllowed, showcaseValidation } from "@/lib/showcase";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a result");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const existing = await db.resultShowcase.findUnique({ where: { id } });
    if (!existing) return fail("Result not found.", 404);
    const patch: Record<string, unknown> = {};
    if (body.studentName !== undefined) patch.studentName = String(body.studentName).trim();
    if (body.exam !== undefined) patch.exam = String(body.exam).trim();
    if (body.achievement !== undefined) patch.achievement = String(body.achievement).trim();
    if (body.score !== undefined) patch.score = body.score === "" ? null : String(body.score).trim();
    if (body.year !== undefined) patch.year = String(body.year).trim();
    if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl === "" ? null : String(body.imageUrl).trim();
    if (body.displayOrder !== undefined && Number.isFinite(Number(body.displayOrder))) {
      patch.displayOrder = Math.floor(Number(body.displayOrder));
    }
    if (body.consent !== undefined) patch.consent = body.consent === true;
    if (body.isActive !== undefined) patch.isActive = body.isActive === true;
    const merged = { ...existing, ...patch } as Record<string, unknown>;
    const invalid = showcaseValidation({
      studentName: merged.studentName,
      exam: merged.exam,
      achievement: merged.achievement,
      score: merged.score ?? "",
      year: merged.year ?? "",
      imageUrl: merged.imageUrl ?? "",
    });
    if (invalid) return fail(invalid, 400);
    if (!activationAllowed(merged.consent === true, merged.isActive === true)) {
      return fail("Publishing requires confirmed consent for the student's name/photo.", 400);
    }
    const row = await db.resultShowcase.update({ where: { id }, data: patch });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Result not found.", 404);
    return serverError("showcase:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a result");
  try {
    await db.resultShowcase.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Result not found.", 404);
    return serverError("showcase:delete", err);
  }
}
