// Phase 3 — Testimonial detail API.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a testimonial");
  try {
    const row = await db.testimonial.findUnique({ where: { id } });
    if (!row) return fail("Testimonial not found.", 404);
    return ok({ item: row });
  } catch (err) {
    return serverError("testimonials:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a testimonial");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const row = await db.testimonial.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.role === "string" ? { role: body.role } : {}),
        ...(typeof body.message === "string" ? { message: body.message } : {}),
        ...(typeof body.photo === "string" ? { photo: body.photo } : {}),
        ...(typeof body.rating === "number" ? { rating: Math.min(5, Math.max(1, body.rating)) } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      },
    });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Testimonial not found.", 404);
    return serverError("testimonials:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a testimonial");
  try {
    await db.testimonial.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Testimonial not found.", 404);
    return serverError("testimonials:delete", err);
  }
}
