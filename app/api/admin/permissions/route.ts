// Phase 19 — Admin Permissions API
// GET: List all permissions with role assignments
// POST: Create new permission

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreatePermissionSchema = z.object({
  key: z.string().min(3).max(100),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  resource: z.string().min(1).max(50),
  action: z.string().min(1).max(50),
  scope: z.enum(["GLOBAL", "BRANCH", "BATCH", "COURSE"]).default("GLOBAL"),
});

export async function GET(req: NextRequest) {
  const auth = await requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Reading permissions");

  try {
    const permissions = await db.adminPermission.findMany({
      where: { isActive: true },
      include: {
        roles: {
          select: { role: true, scopeValue: true },
        },
      },
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });

    const items = permissions.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      resource: p.resource,
      action: p.action,
      scope: p.scope,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      roles: p.roles.map((r) => ({ role: r.role, scopeValue: r.scopeValue })),
    }));

    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("admin:permissions:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Creating permission");

  let body: z.infer<typeof CreatePermissionSchema>;
  try {
    const json = await req.json();
    const parsed = CreatePermissionSchema.safeParse(json);
    if (!parsed.success) {
      return fail(`Invalid request: ${parsed.error.issues.map((e) => e.message).join(", ")}`, 400);
    }
    body = parsed.data;
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const permission = await db.adminPermission.create({
      data: {
        key: body.key,
        name: body.name,
        description: body.description,
        resource: body.resource,
        action: body.action,
        scope: body.scope,
      },
    });

    await writeAuditLog(
      auth.user.id,
      auth.user.email,
      "CREATE",
      "AdminPermission",
      permission.id,
      null,
      permission,
      req,
      `perm-create-${permission.id}`
    );

    return ok({
      item: {
        id: permission.id,
        key: permission.key,
        name: permission.name,
        description: permission.description,
        resource: permission.resource,
        action: permission.action,
        scope: permission.scope,
        isActive: permission.isActive,
        createdAt: permission.createdAt.toISOString(),
        roles: [],
      },
    }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes("P2002")) {
      return fail("Permission key already exists", 409);
    }
    return serverError("admin:permissions:create", err);
  }
}