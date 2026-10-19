// Phase 19 — Admin Permission Update/Delete
// PATCH: Update permission
// DELETE: Delete permission

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdatePermissionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Updating permission");

  let body: z.infer<typeof UpdatePermissionSchema>;
  try {
    const json = await req.json();
    const parsed = UpdatePermissionSchema.safeParse(json);
    if (!parsed.success) {
      return fail(`Invalid request: ${parsed.error.issues.map((e) => e.message).join(", ")}`, 400);
    }
    body = parsed.data;
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const existing = await db.adminPermission.findUnique({ where: { id } });
    if (!existing) return fail("Permission not found", 404);

    const updated = await db.adminPermission.update({
      where: { id },
      data: body,
    });

    await writeAuditLog(
      auth.user.id,
      auth.user.email,
      "UPDATE",
      "AdminPermission",
      id,
      existing,
      updated,
      req,
      `perm-update-${id}`
    );

    return ok({
      item: {
        id: updated.id,
        key: updated.key,
        name: updated.name,
        description: updated.description,
        resource: updated.resource,
        action: updated.action,
        scope: updated.scope,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return serverError("admin:permissions:update", err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Deleting permission");

  try {
    const existing = await db.adminPermission.findUnique({ where: { id } });
    if (!existing) return fail("Permission not found", 404);

    // Delete role assignments first
    await db.adminRolePermission.deleteMany({ where: { permissionId: id } });
    await db.adminPermission.delete({ where: { id } });

    await writeAuditLog(
      auth.user.id,
      auth.user.email,
      "DELETE",
      "AdminPermission",
      id,
      existing,
      null,
      req,
      `perm-delete-${id}`
    );

    return ok({ deleted: true });
  } catch (err) {
    return serverError("admin:permissions:delete", err);
  }
}