// Phase 19 — Admin Role Permission Revoke
// DELETE: Revoke permission from role

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const RevokePermissionSchema = z.object({
  role: z.enum(["ADMIN", "FACULTY", "STUDENT"]),
  scopeValue: z.string().optional().nullable(),
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ permissionId: string }> }
) {
  const { permissionId } = await params;
  const auth = await requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Revoking permission from role");

  let body: z.infer<typeof RevokePermissionSchema>;
  try {
    const json = await req.json();
    const parsed = RevokePermissionSchema.safeParse(json);
    if (!parsed.success) {
      return fail(`Invalid request: ${parsed.error.issues.map((e) => e.message).join(", ")}`, 400);
    }
    body = parsed.data;
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const assignment = await db.adminRolePermission.findUnique({
      where: {
        role_permissionId_scopeValue: {
          role: body.role,
          permissionId,
          scopeValue: body.scopeValue || "",
        },
      },
      include: {
        permission: { select: { key: true, name: true } },
      },
    });

    if (!assignment) return fail("Permission assignment not found", 404);

    await db.adminRolePermission.delete({
      where: {
        role_permissionId_scopeValue: {
          role: body.role,
          permissionId,
          scopeValue: body.scopeValue || "",
        },
      },
    });

    await writeAuditLog(
      auth.user.id,
      auth.user.email,
      "PERMISSION_REVOKE",
      "AdminRolePermission",
      `${body.role}-${permissionId}-${body.scopeValue || "global"}`,
      { role: body.role, permissionId, scopeValue: body.scopeValue, permission: assignment.permission },
      null,
      req,
      `perm-revoke-${body.role}-${permissionId}`
    );

    return ok({ revoked: true });
  } catch (err) {
    return serverError("admin:permissions:roles:revoke", err);
  }
}