// Phase 12 — PDF import access scope (server-side).
// ADMIN: any import. FACULTY: only imports they created. Never trust
// client-supplied ownership.

import type { PrismaClient } from "@prisma/client";

type Db = PrismaClient;

export interface ImportScope {
  ok: boolean;
  status?: number;
  error?: string;
  importId?: string;
  stagingTestId?: string | null;
}

export async function importScope(
  db: Db,
  role: string,
  userId: string,
  importId: string
): Promise<ImportScope & { stagingTestId: string | null }> {
  const imp = await db.pdfImport.findUnique({ where: { id: importId } });
  if (!imp) return { ok: false, status: 404, error: "Import not found.", stagingTestId: null };
  if (role !== "ADMIN" && imp.createdById !== userId) {
    return { ok: false, status: 403, error: "Forbidden.", stagingTestId: null };
  }
  return { ok: true, stagingTestId: imp.stagingTestId };
}
