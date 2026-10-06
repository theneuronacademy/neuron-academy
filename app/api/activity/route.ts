// Recent activity for the admin dashboard (ADMIN only).
// Merges recent tests + results + enquiries into { id, text, time }.
// Demo fallback when DATABASE_URL is missing so the UI never crashes.

import { NextRequest } from "next/server";
import { ok, fail, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { DEMO_ACTIVITY } from "@/data/admin";

export const dynamic = "force-dynamic";

function fmtTime(v: Date | string): string {
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return ok({ items: DEMO_ACTIVITY, source: "demo" });
  try {
    const [tests, results, enquiries] = await Promise.all([
      db.test.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, status: true, createdAt: true } }),
      db.result.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { student: { select: { name: true } }, test: { select: { title: true } } },
      }),
      db.enquiry.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, createdAt: true } }),
    ]);
    type Item = { id: string; text: string; time: string; at: number };
    const items: Item[] = [
      ...tests.map((t) => ({
        id: `test-${t.id}`,
        text: `Test ${String(t.status).toLowerCase()} — ${t.title}`,
        time: fmtTime(t.createdAt),
        at: new Date(t.createdAt).getTime(),
      })),
      ...results.map((r) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        id: `result-${(r as any).id}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        text: `Result uploaded — ${(r as any).student?.name ?? "Student"} (${(r as any).test?.title ?? "test"})`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        time: fmtTime((r as any).createdAt),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        at: new Date((r as any).createdAt).getTime(),
      })),
      ...enquiries.map((e) => ({
        id: `enq-${e.id}`,
        text: `New enquiry — ${e.name}`,
        time: fmtTime(e.createdAt),
        at: new Date(e.createdAt).getTime(),
      })),
    ];
    items.sort((a, b) => b.at - a.at);
    const mapped = items.slice(0, 8).map(({ id, text, time }) => ({ id, text, time }));
    return ok({ items: mapped, source: "database" });
  } catch (err) {
    return serverError("activity:list", err);
  }
}
