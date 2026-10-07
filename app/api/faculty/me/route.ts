// Phase 10 — own faculty profile (server-derived, never client ids).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { isPhone } from "@/lib/validation";

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

export async function PATCH(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Updating profile");
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "FACULTY") return fail("Forbidden.", 403);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  if (body.phone !== undefined && body.phone !== "" && !isPhone(body.phone)) return fail("Invalid phone.", 400);
  const str = (v: unknown, max: number): string | undefined => {
    if (v === undefined) return undefined;
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t ? t.slice(0, max) : undefined;
  };
  try {
    const current = await db.faculty.findFirst({
      where: { OR: [{ userId: viewer.id }, { email: viewer.email.toLowerCase() }] },
      select: { id: true },
    });
    if (!current) return fail("Faculty profile not found.", 404);
    const row = await db.faculty.update({
      where: { id: current.id },
      data: {
        ...(str(body.name, 80) ? { name: str(body.name, 80) as string } : {}),
        ...(typeof body.phone === "string" && body.phone ? { phone: body.phone } : {}),
        ...(str(body.qualification, 120) ? { qualification: str(body.qualification, 120) as string } : {}),
        ...(str(body.experience, 120) ? { experience: str(body.experience, 120) as string } : {}),
        ...(str(body.bio, 500) ? { bio: str(body.bio, 500) as string } : {}),
      },
      select: { id: true, facultyId: true, name: true, email: true, phone: true, subject: true, qualification: true, status: true },
    });
    return ok({ item: row });
  } catch (err) {
    return serverError("faculty:me-update", err);
  }
}
