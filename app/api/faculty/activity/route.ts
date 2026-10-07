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
  if (!db) return dbNotConfigured("Reading faculty activity");
  try {
    const batchIds = auth.user.role === "ADMIN"
      ? (await db.batch.findMany({ select: { id: true }, take: 500 })).map((b) => b.id)
      : await facultyBatchIds(db, auth.user.id);
    const scope = batchIds.length ? { batchId: { in: batchIds } } : { id: "__none__" };
    const [att, tests, results] = await Promise.all([
      db.attendance.findMany({ where: scope, orderBy: { updatedAt: "desc" }, take: 5, include: { student: { select: { name: true } }, batch: { select: { name: true } } } }).catch(() => []),
      db.test.findMany({
        where: { OR: [{ createdById: auth.user.id }, ...(batchIds.length ? [{ batchId: { in: batchIds } }] : [])] },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, status: true, updatedAt: true },
      }).catch(() => []),
      db.result.findMany({
        where: { test: { OR: [{ createdById: auth.user.id }, ...(batchIds.length ? [{ batchId: { in: batchIds } }] : [])] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, percentage: true, createdAt: true, student: { select: { name: true } }, test: { select: { title: true } } },
      }).catch(() => []),
    ]);
    const items = [
      ...att.map((a) => ({ id: `att-${a.id}`, text: `Attendance marked for ${a.student?.name ?? "student"} (${a.batch?.name ?? ""})`, time: new Date(a.updatedAt).toLocaleString(), type: "attendance" as const })),
      ...tests.map((t) => ({ id: `test-${t.id}`, text: `Test "${t.title}" (${t.status})`, time: new Date(t.updatedAt).toLocaleString(), type: "test" as const })),
      ...results.map((r) => ({ id: `res-${r.id}`, text: `Result: ${r.student?.name ?? "student"} scored ${r.percentage}% in ${r.test?.title ?? ""}`, time: new Date(r.createdAt).toLocaleString(), type: "result" as const })),
    ].slice(0, 10);
    return ok({ items });
  } catch (err) {
    return serverError("faculty:activity", err);
  }
}
