// Phase 12 — import session detail (ADMIN all, FACULTY own).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { importScope } from "@/lib/importScope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading import");
  try {
    const scope = await importScope(db, auth.user.role, auth.user.id, id);
    if (!scope.ok) return fail(scope.error ?? "Forbidden.", scope.status ?? 403);
    const imp = await db.pdfImport.findUnique({ where: { id } });
    return ok({ item: imp });
  } catch (err) {
    return serverError("tests:import-get", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting import");
  try {
    const scope = await importScope(db, auth.user.role, auth.user.id, id);
    if (!scope.ok) return fail(scope.error ?? "Forbidden.", scope.status ?? 403);
    // Staging test deletion cascades its questions.
    if (scope.stagingTestId) {
      await db.test.delete({ where: { id: scope.stagingTestId } }).catch(() => undefined);
    }
    await db.pdfImport.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    return serverError("tests:import-delete", err);
  }
}
