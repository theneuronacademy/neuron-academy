// Study material library.
// GET  /api/materials — active materials for STUDENT/FACULTY (?subject=,
//   ?kind=); ADMIN sees all incl. inactive.
// POST /api/materials — ADMIN: { title, subject?, className?, kind
//   NOTE|VIDEO|LINK|PDF, url?, description?, displayOrder? }.
// PATCH/DELETE /api/materials/[id] — ADMIN.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const KINDS = ["NOTE", "VIDEO", "LINK", "PDF"] as const;

export async function GET(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading materials");
  try {
    const q = new URL(req.url).searchParams;
    const subject = (q.get("subject") ?? "").trim();
    const kind = (q.get("kind") ?? "").trim().toUpperCase();
    const base: Record<string, unknown> = viewer.role === "ADMIN" ? {} : { isActive: true };
    if (subject) base.subject = subject;
    if ((KINDS as readonly string[]).includes(kind)) base.kind = kind;
    const items = await db.material.findMany({
      where: base,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return ok({ items, source: "database" });
  } catch (err) {
    return serverError("materials:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating material");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const kind = typeof body.kind === "string" ? body.kind.trim().toUpperCase() : "NOTE";
  if (!title) return fail("title is required.", 400);
  if (!(KINDS as readonly string[]).includes(kind)) return fail("kind must be NOTE, VIDEO, LINK or PDF.", 400);
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (url && !/^https?:\/\//i.test(url)) return fail("url must start with http(s)://.", 400);
  try {
    const created = await db.material.create({
      data: {
        title: title.slice(0, 160),
        subject: typeof body.subject === "string" && body.subject.trim() ? body.subject.trim().slice(0, 80) : null,
        className: typeof body.className === "string" && body.className.trim() ? body.className.trim().slice(0, 40) : null,
        kind: kind as (typeof KINDS)[number],
        url: url || null,
        description: typeof body.description === "string" ? body.description.trim().slice(0, 1000) : null,
        displayOrder: Number.isInteger(Number(body.displayOrder)) ? Number(body.displayOrder) : 0,
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("materials:create", err);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating material");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return fail("id is required.", 400);
  const update: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim().slice(0, 160);
  if (body.subject !== undefined) update.subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim().slice(0, 80) : null;
  if (body.className !== undefined) update.className = typeof body.className === "string" && body.className.trim() ? body.className.trim().slice(0, 40) : null;
  if (body.kind !== undefined) {
    const k = typeof body.kind === "string" ? body.kind.trim().toUpperCase() : "";
    if (!(KINDS as readonly string[]).includes(k)) return fail("kind must be NOTE, VIDEO, LINK or PDF.", 400);
    update.kind = k;
  }
  if (body.url !== undefined) {
    const u = typeof body.url === "string" ? body.url.trim() : "";
    if (u && !/^https?:\/\//i.test(u)) return fail("url must start with http(s)://.", 400);
    update.url = u || null;
  }
  if (typeof body.description === "string") update.description = body.description.trim().slice(0, 1000);
  if (typeof body.displayOrder === "number" && Number.isInteger(body.displayOrder)) update.displayOrder = body.displayOrder;
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;
  if (Object.keys(update).length === 0) return fail("No valid update fields provided.", 400);
  try {
    const item = await db.material.update({ where: { id }, data: update });
    return ok({ item });
  } catch {
    return fail("Material not found.", 404);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting material");
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id.trim()) return fail("id is required.", 400);
  try {
    await db.material.delete({ where: { id: id.trim() } });
    return ok({ deleted: true });
  } catch {
    return fail("Material not found.", 404);
  }
}
