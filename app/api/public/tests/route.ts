// Phase 13 — public scholarship test catalogue (no auth, cacheable).
// Lists published/live FREE + PAID tests. PRIVATE tests are never public.
// Returns metadata ONLY — never questions, answers, or admin internals.

import { dbNotConfigured, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";

export const dynamic = "force-dynamic";
// Public catalogue is safe to cache briefly; personalized data is never here.
export const revalidate = 60;

export async function GET() {
  const db = getDb();
  if (!db) return dbNotConfigured("Reading scholarship tests");
  try {
    const rows = await db.test.findMany({
      where: { isActive: true, status: { in: ["PUBLISHED", "LIVE"] }, accessType: { in: ["FREE", "PAID"] } },
      select: {
        id: true,
        title: true,
        description: true,
        duration: true,
        totalQuestions: true,
        totalMarks: true,
        startTime: true,
        endTime: true,
        status: true,
        type: true,
        accessType: true,
        price: true,
        batch: { select: { id: true, name: true } },
        _count: { select: { questions: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("public:tests", err);
  }
}
