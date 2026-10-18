// Phase 19 — Admin Role Permissions API
// GET: List all role-permission assignments
// POST: Assign permission to role

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AssignPermissionSchema = z.object({
  role: z.enum(["ADMIN", "FACULTY", "STUDENT"]),
  permissionId: z.string().cuid(),
  scope: z.enum(["GLOBAL", "BRANCH", "BATCH", "COURSE"]).default("GLOBAL"),
  scopeValue: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const auth = await requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Reading role permissions");

  try {
    const rolePermissions = await db.adminRolePermission.findMany({
      include: {
        permission: { select: { id: true, key: true, name: true, resource: true, action: true, scope: true } },
      },
      orderBy: [{ role: "asc" }, { permission: { resource: "asc" } }],
    });

    const items = rolePermissions.map((rp) => ({
      role: rp.role,
      permissionId: rp.permissionId,
      permission: rp.permission,
      scopeValue: rp.scopeValue,
      createdAt: rp.createdAt.toISOString(),
    }));

    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("admin:permissions:roles:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Assigning permission to role");

  let body: z.infer<typeof AssignPermissionSchema>;
  try {
    const json = await req.json();
    const parsed = AssignPermissionSchema.safeParse(json);
    if (!parsed.success) {
      return fail(`Invalid request: ${parsed.error.errors.map((e) => e.message).join(", ")}`, 400);
    }
    body = parsed.data;
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const permission = await db.adminPermission.findUnique({ where: { id: body.permissionId } });
    if (!permission) return fail("Permission not found", 404);

    const assignment = await db.adminRolePermission.upsert({
      where: {
        role_permissionId_scopeValue: {
          role: body.role,
          permissionId: body.permissionId,
          scopeValue: body.scopeValue || "",
        },
      },
      create: {
        role: body.role,
        permissionId: body.permissionId,
        scopeValue: body.scopeValue || null,
      },
      update: {},
      include: {
        permission: { select: { id: true, key: true, name: true, resource: true, action: true, scope: true } },
      },
    });

    await writeAuditLog(
      auth.user.id,
      auth.user.email,
      "PERMISSION_GRANT",
      "AdminRolePermission",
      `${assignment.role}-${assignment.permissionId}-${assignment.scopeValue || "global"}`,
      null,
      { role: assignment.role, permissionId: assignment.permissionId, scopeValue: assignment.scopeValue },
      req,
      `perm-assign-${assignment.role}-${assignment.permissionId}`
    );

    return ok({
      item: {
        role: assignment.role,
        permissionId: assignment.permissionId,
        permission: assignment.permission,
        scopeValue: assignment.scopeValue,
        createdAt: assignment.createdAt.toISOString(),
      },
    }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes("P2002")) {
      return fail("Permission already assigned to this role with this scope", 409);
    }
    return serverError("admin:permissions:roles:assign", err);
  }
}