// Phase 3 — Faculty detail API.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { isEmail, isPhone } from "@/lib/validation";
import { notifyMessages } from "@/lib/notify";
import { dispatchNotification } from "@/services/notificationEngine";

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
    // Approval transition gate: read pre-update state so repeat approvals
    // (or unrelated edits) never re-notify. Concurrent double-approvals
    // share the engine fallback idempotency bucket (same title/message/
    // audience within 10 min) and converge to a single DUPLICATE.
    const previous = await db.faculty.findUnique({
      where: { id },
      select: { status: true, user: { select: { isActive: true } } },
    }).catch(() => null);
    const row = await db.faculty.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.email === "string" ? { email: body.email } : {}),
        ...(typeof body.phone === "string" ? { phone: body.phone } : {}),
        ...(typeof body.qualification === "string" ? { qualification: body.qualification } : {}),
        ...(typeof body.experience === "string" ? { experience: body.experience } : {}),
        ...(typeof body.bio === "string" ? { bio: body.bio } : {}),
        ...(typeof body.subject === "string" ? { subject: body.subject || null } : {}),
        ...(typeof body.designation === "string" ? { designation: body.designation || null } : {}),
        // Photo may be set to a new URL; empty string clears it.
        ...(typeof body.photo === "string" ? { photo: body.photo || null } : {}),
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
    // Phase 19 — approval notification (transition into active only, never
    // on unrelated edits or repeat approvals). Never fails the update:
    // dispatchNotification never throws; channels stay isolated.
    if (
      body.isActive === true &&
      (previous?.status !== "ACTIVE" || previous?.user?.isActive === false)
    ) {
      const msg = notifyMessages.facultyApproved();
      await dispatchNotification(db, {
        event: "FACULTY_NOTIFICATION",
        actor: { id: auth.user.id, role: auth.user.role },
        audience: { kind: "INDIVIDUAL", facultyId: id },
        title: msg.title,
        message: msg.message,
        templateKey: "FACULTY_NOTIFICATION",
        vars: { message: msg.message },
        createdById: auth.user.id,
        internal: true,
      });
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
    // Phase 17 — destructive safety: reassign batches before deleting.
    const batches = await db.batch.count({ where: { facultyId: id } });
    if (batches > 0) {
      return fail(
        `Cannot delete: this faculty member is assigned to ${batches} batch(es). Reassign the batches or deactivate the faculty instead.`,
        409
      );
    }
    await db.faculty.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Faculty not found.", 404);
    return serverError("faculty:delete", err);
  }
}
