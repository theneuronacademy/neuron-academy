import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["FACULTY", "ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading faculty batches");
  try {
    const batchIds = auth.user.role === "ADMIN"
      ? (await db.batch.findMany({ select: { id: true }, take: 500 })).map((b) => b.id)
      : await facultyBatchIds(db, auth.user.id);
    const rows = await db.batch.findMany({
      where: batchIds.length ? { id: { in: batchIds } } : { id: "__none__" },
      include: { course: { select: { name: true } }, _count: { select: { students: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const items = rows.map((b) => ({
      id: b.id,
      name: b.name,
      course: b.course?.name ?? "—",
      studentCount: b._count?.students ?? 0,
      startDate: b.startDate ? new Date(b.startDate).toISOString().slice(0, 10) : "",
      endDate: b.endDate ? new Date(b.endDate).toISOString().slice(0, 10) : "",
      status: String(b.status ?? "ACTIVE").toLowerCase(),
    }));
    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("faculty:batches", err);
  }
}
