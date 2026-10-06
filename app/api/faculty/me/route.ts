// Phase 10 — own faculty profile (server-derived, never client ids).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Reading profile");
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "FACULTY") return fail("Forbidden.", 403);
  try {
    const faculty = await db.faculty.findFirst({
      where: { OR: [{ userId: viewer.id }, { email: viewer.email.toLowerCase() }] },
      include: { batches: { select: { id: true, name: true } } },
    });
    if (!faculty) return fail("Faculty profile not found.", 404);
    return ok({
      item: {
        id: faculty.id,
        facultyId: faculty.facultyId,
        name: faculty.name,
        email: faculty.email,
        phone: faculty.phone,
        subject: faculty.subject,
        qualification: faculty.qualification,
        batches: faculty.batches,
        status: faculty.status,
      },
    });
  } catch (err) {
    return serverError("faculty:me", err);
  }
}
