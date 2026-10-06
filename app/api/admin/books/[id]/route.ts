// Phase 14 — admin book update/delete (ADMIN only).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { deleteStorageObject } from "@/lib/storageProvider";

export const dynamic = "force-dynamic";

const VIS = ["ALL", "REGULAR_ONLY"] as const;
const URL_OK = /^(\/uploads\/|https?:\/\/|supabase:\/\/[^/]+\/[^/]+\/.+)/;

function clean(v: unknown, max: number): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  return v.trim().slice(0, max);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a book");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  if (body.pdfUrl !== undefined && body.pdfUrl !== null && body.pdfUrl !== "") {
    const u = clean(body.pdfUrl, 1000) ?? "";
    if (!URL_OK.test(u)) return fail("Invalid PDF URL.", 400);
    if (u.includes("/object/sign/")) return fail("Invalid PDF URL.", 400);
  }
  const coverBody = clean(body.coverImageUrl, 1000);
  if (coverBody && coverBody.includes("/object/sign/")) return fail("Invalid cover URL.", 400);
  try {
    const row = await db.book.update({
      where: { id },
      data: {
        ...(typeof body.title === "string" && body.title.trim() ? { title: body.title.trim().slice(0, 160) } : {}),
        ...(body.description !== undefined ? { description: clean(body.description, 2000) ?? null } : {}),
        ...(body.author !== undefined ? { author: clean(body.author, 120) ?? null } : {}),
        ...(body.subject !== undefined ? { subject: clean(body.subject, 80) ?? null } : {}),
        ...(body.className !== undefined ? { className: clean(body.className, 40) ?? null } : {}),
        ...(body.category !== undefined ? { category: clean(body.category, 80) ?? null } : {}),
        ...(body.coverImageUrl !== undefined ? { coverImageUrl: clean(body.coverImageUrl, 1000) ?? null } : {}),
        ...(body.pdfUrl !== undefined ? { pdfUrl: clean(body.pdfUrl, 1000) ?? null } : {}),
        ...(body.externalUrl !== undefined ? { externalUrl: clean(body.externalUrl, 1000) ?? null } : {}),
        ...(body.visibleTo !== undefined && VIS.includes(body.visibleTo as (typeof VIS)[number])
          ? { visibleTo: body.visibleTo as (typeof VIS)[number] }
          : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        ...(typeof body.order === "number" && Number.isFinite(body.order) ? { order: Math.floor(body.order) } : {}),
      },
    });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Book not found.", 404);
    return serverError("admin-books:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a book");
  try {
    const existing = await db.book.findUnique({ where: { id }, select: { coverImageUrl: true, pdfUrl: true } });
    if (!existing) return fail("Book not found.", 404);
    // Delete owned storage objects first. On durable (Supabase) storage a
    // failed object delete fails the whole request — never pretend cleanup
    // succeeded and never orphan cover files. Local files are best-effort.
    const owned = [existing.coverImageUrl, existing.pdfUrl].filter(
      (u): u is string => typeof u === "string" && (u.startsWith("supabase://") || u.startsWith("/uploads/"))
    );
    for (const ref of owned) {
      if (!(await deleteStorageObject(ref))) {
        return fail("Could not remove the stored book files. Book was not deleted.", 502);
      }
    }
    await db.book.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Book not found.", 404);
    return serverError("admin-books:delete", err);
  }
}
