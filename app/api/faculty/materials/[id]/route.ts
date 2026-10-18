// Faculty Material Detail API - Update/Delete single material
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

const KINDS = ["NOTE", "VIDEO", "LINK", "PDF"] as const;

async function verifyFacultyAccess(db: ReturnType<typeof getDb>, userId: string, batchId: string) {
  const allowed = await facultyBatchIds(db, userId);
  return allowed.includes(batchId);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating material");

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const material = await db.material.findUnique({
    where: { id },
    select: { id: true, batchId: true },
  });

  if (!material) return fail("Material not found.", 404);

  // Verify faculty access
  if (auth.user.role === "FACULTY") {
    const hasAccess = await verifyFacultyAccess(db, auth.user.id, material.batchId);
    if (!hasAccess) return fail("Forbidden: material not in your assigned batches.", 403);
  }

  const { title, subject, kind, url, description, isActive, displayOrder } = body;

  if (kind && !KINDS.includes(kind as (typeof KINDS)[number])) {
    return fail(`Invalid kind. Must be one of: ${KINDS.join(", ")}`, 400);
  }

  try {
    const updated = await db.material.update({
      where: { id },
      data: {
        ...(title && { title: String(title) }),
        ...(subject && { subject: String(subject) }),
        ...(kind && { kind: kind as (typeof KINDS)[number] }),
        ...(url !== undefined && { url: url ? String(url) : null }),
        ...(description !== undefined && { description: description ? String(description) : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(displayOrder !== undefined && { displayOrder: Number(displayOrder) }),
      },
      include: { batch: { select: { id: true, name: true } } },
    });

    return ok({ item: updated });
  } catch (err) {
    return serverError("materials:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting material");

  const { id } = await params;

  const material = await db.material.findUnique({
    where: { id },
    select: { id: true, batchId: true },
  });

  if (!material) return fail("Material not found.", 404);

  // Verify faculty access
  if (auth.user.role === "FACULTY") {
    const hasAccess = await verifyFacultyAccess(db, auth.user.id, material.batchId);
    if (!hasAccess) return fail("Forbidden: material not in your assigned batches.", 403);
  }

  try {
    await db.material.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    return serverError("materials:delete", err);
  }
}