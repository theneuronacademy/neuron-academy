// Faculty Materials API - Lesson content management
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

const KINDS = ["NOTE", "VIDEO", "LINK", "PDF"] as const;

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading materials");

  try {
    const params = new URL(req.url).searchParams;
    const batchId = params.get("batchId");

    let where: Record<string, unknown> = {};

    if (auth.user.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (batchId) {
        if (!allowed.includes(batchId)) return fail("Forbidden: batch not assigned to you.", 403);
        where.batchId = batchId;
      } else {
        where.batchId = { in: allowed.length ? allowed : ["__none__"] };
      }
    } else if (batchId) {
      where.batchId = batchId;
    }

    const materials = await db.material.findMany({
      where,
      include: {
        batch: { select: { id: true, name: true } },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    return ok({ items: materials, source: "database" });
  } catch (err) {
    return serverError("materials:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating material");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const missing = missingFields(body, ["title", "subject", "batchId", "kind"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);

  const { title, subject, batchId, kind, url, description, displayOrder = 0 } = body;

  if (!KINDS.includes(kind as (typeof KINDS)[number])) {
    return fail(`Invalid kind. Must be one of: ${KINDS.join(", ")}`, 400);
  }

  // Verify faculty access to batch
  if (auth.user.role === "FACULTY") {
    const allowed = await facultyBatchIds(db, auth.user.id);
    if (!allowed.includes(String(batchId))) return fail("Forbidden: batch not assigned to you.", 403);
  }

  // Verify batch exists
  const batch = await db.batch.findUnique({ where: { id: String(batchId) }, select: { id: true } });
  if (!batch) return fail("Batch not found.", 404);

  try {
    const material = await db.material.create({
      data: {
        title: String(title),
        subject: String(subject),
        batchId: String(batchId),
        kind: kind as (typeof KINDS)[number],
        url: url ? String(url) : null,
        description: description ? String(description) : null,
        displayOrder: Number(displayOrder),
        isActive: true,
      },
      include: { batch: { select: { id: true, name: true } } },
    });

    return ok({ item: material }, 201);
  } catch (err) {
    return serverError("materials:create", err);
  }
}