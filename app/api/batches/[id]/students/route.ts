// Phase 6 — batch student roster (minimal fields for marks entry / review).
// ADMIN: any batch. FACULTY: assigned batches only. No PII beyond names.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: batchId } = await params;
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading batch students");
  try {
    if (auth.user.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (!allowed.includes(batchId)) return fail("You can view only your assigned batches.", 403);
    }
    const rows = await db.student.findMany({
      where: { batchId, status: "ACTIVE" },
      select: { id: true, studentId: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("batches:students", err);
  }
}
