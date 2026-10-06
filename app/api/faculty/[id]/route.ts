// Phase 3 — Faculty detail API.
// TODO auth: enforce ADMIN role once the session layer lands.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { isEmail, isPhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAdmin(f: any) {
  return {
    id: f.id,
    name: f.name,
    photo: f.photo ?? "",
    email: f.email,
    phone: f.phone,
    subject: "—",
    qualification: f.qualification ?? "—",
    experience: f.experience ?? "—",
    batches: Array.isArray(f.batches) ? f.batches.map((b: { name?: string }) => b?.name ?? "") : [],
    status: String(f.status ?? "ACTIVE").toLowerCase() === "inactive" ? "inactive" : "active",
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading faculty");
  try {
    const row = await db.faculty.findUnique({ where: { id }, include: { batches: true } });
    if (!row) return fail("Faculty not found.", 404);
    return ok({ item: toAdmin(row) });
  } catch (err) {
    return serverError("faculty:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating faculty");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  if (body.email !== undefined && !isEmail(body.email)) return fail("Invalid email.", 400);
  if (body.phone !== undefined && !isPhone(body.phone)) return fail("Invalid phone.", 400);
  try {
    const row = await db.faculty.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.email === "string" ? { email: body.email } : {}),
        ...(typeof body.phone === "string" ? { phone: body.phone } : {}),
        ...(typeof body.qualification === "string" ? { qualification: body.qualification } : {}),
        ...(typeof body.experience === "string" ? { experience: body.experience } : {}),
        ...(typeof body.bio === "string" ? { bio: body.bio } : {}),
        ...(body.status === "ACTIVE" || body.status === "INACTIVE" ? { status: body.status } : {}),
      },
      include: { batches: true, user: { select: { id: true } } },
    });
    // Phase 10: ADMIN approval toggle — activates/deactivates the login account.
    // Approving also flips the faculty profile ACTIVE.
    if (typeof body.isActive === "boolean" && row.user) {
      await db.user.update({ where: { id: row.user.id }, data: { isActive: body.isActive } });
      if (body.isActive) {
        await db.faculty.update({ where: { id }, data: { status: "ACTIVE" } });
      }
    }
    return ok({ item: toAdmin(row) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Faculty not found.", 404);
    return serverError("faculty:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Removing faculty");
  try {
    await db.faculty.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Faculty not found.", 404);
    return serverError("faculty:delete", err);
  }
}
