// Phase 14 — own profile photo upload/remove (STUDENT, own only).
// POST: multipart form-data { file }. Validates type/size/magic bytes,
// stores via the storage abstraction, links photoUrl on the own profile.
// DELETE: unlinks (and best-effort removes the local file). Never accepts a
// client-chosen path; filenames are regenerated server-side.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { getScopedStudent } from "@/lib/studentScope";
import { deleteStorageObject, saveUpload, validatePhotoUpload } from "@/lib/storageProvider";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT") return fail("Forbidden.", 403);
  const db = getDb();
  if (!db) return dbNotConfigured("Uploading photo");
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    if (!scoped || scoped.status !== "ACTIVE") return fail("Student profile not found or inactive.", 403);
    let file: File | null = null;
    try {
      const form = await req.formData();
      const v = form.get("file");
      if (v instanceof File) file = v;
    } catch {
      return fail("Invalid upload.", 400);
    }
    if (!file) return fail("No file provided.", 400);
    const buf = Buffer.from(await file.arrayBuffer());
    const problem = validatePhotoUpload(buf, file.name);
    if (problem) return fail(problem, 400);
    const saved = await saveUpload("photos", buf, file.name);
    if (!saved.ok) return fail(saved.error, 502);
    const prev = await db.student.findUnique({ where: { id: scoped.id }, select: { photoUrl: true } });
    // DB stores the durable reference (supabase://… or local path); the
    // response carries a displayable URL. Previous object cleanup is
    // reported honestly — linkage update is authoritative.
    await db.student.update({ where: { id: scoped.id }, data: { photoUrl: saved.ref } });
    let previousRemoved = true;
    if (prev?.photoUrl && prev.photoUrl !== saved.ref) previousRemoved = await deleteStorageObject(prev.photoUrl);
    return ok({ photoUrl: saved.url, previousRemoved }, 201);
  } catch (err) {
    return serverError("students:photo-upload", err);
  }
}

export async function DELETE(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT") return fail("Forbidden.", 403);
  const db = getDb();
  if (!db) return dbNotConfigured("Removing photo");
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    if (!scoped) return fail("Student profile not found.", 404);
    const prev = await db.student.findUnique({ where: { id: scoped.id }, select: { photoUrl: true } });
    // Fail closed on durable storage: a failed object delete keeps the link
    // so the user can retry instead of silently orphaning the file.
    if (prev?.photoUrl && !(await deleteStorageObject(prev.photoUrl))) {
      return fail("Could not remove the stored photo. Try again.", 502);
    }
    await db.student.update({ where: { id: scoped.id }, data: { photoUrl: null } });
    return ok({ removed: true });
  } catch (err) {
    return serverError("students:photo-remove", err);
  }
}
