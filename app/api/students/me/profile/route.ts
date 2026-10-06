// Phase 14 — own profile read + self-service update (STUDENT, own only).
// Editable allowlist: name, photoUrl, gender, address, city, school,
// className, parentName, parentMobile. Protected (403 if attempted):
// mobile/phone, email, studentType, status, batch, enrollment. All fields
// validated server-side. Identity always derived from the session.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { STUDENT_EDITABLE_FIELDS, STUDENT_PROTECTED_FIELDS, getScopedStudent, sanitizeStudent } from "@/lib/studentScope";
import { resolveStorageUrl } from "@/lib/storageProvider";

export const dynamic = "force-dynamic";

const GENDERS = ["male", "female", "other"];

function cleanStr(v: unknown, max: number): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

export async function GET(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT") return fail("Forbidden.", 403);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading profile");
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    if (!scoped) return fail("Student profile not found.", 404);
    const row = await db.student.findUnique({
      where: { id: scoped.id },
      include: { batch: { select: { id: true, name: true } }, course: { select: { id: true, name: true } } },
    });
    if (!row) return fail("Student profile not found.", 404);
    // Translate durable storage refs into displayable URLs at read time.
    const item = sanitizeStudent(row) as Record<string, unknown>;
    if (typeof item.photoUrl === "string" && item.photoUrl.startsWith("supabase://")) {
      const resolved = await resolveStorageUrl(item.photoUrl);
      item.photoUrl = resolved ?? null;
    }
    return ok({ item });
  } catch (err) {
    return serverError("students:profile-get", err);
  }
}

export async function PATCH(req: NextRequest) {
  const viewer = getUserFromRequest(req);
  if (!viewer) return fail("Not authenticated.", 401);
  if (viewer.role !== "STUDENT") return fail("Forbidden.", 403);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating profile");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  // Reject protected fields outright — visible, auditable denial.
  const attempted = (Object.keys(body) as string[]).filter((k) =>
    (STUDENT_PROTECTED_FIELDS as readonly string[]).includes(k)
  );
  if (attempted.length > 0) {
    return fail(
      `These fields can only be updated by the academy office: ${attempted.join(", ")}. Contact admin to update.`,
      403
    );
  }
  try {
    const scoped = await getScopedStudent(db, viewer.id, viewer.email);
    if (!scoped || scoped.status !== "ACTIVE") return fail("Student profile not found or inactive.", 403);
    const data: Record<string, string | null> = {};
    const name = cleanStr(body.name, 80);
    if (name !== undefined) {
      if (name.length < 2) return fail("Name must be at least 2 characters.", 400);
      data.name = name;
    }
    const photoUrl = cleanStr(body.photoUrl, 500);
    if (photoUrl !== undefined) {
      if (!/^(\/uploads\/|https?:\/\/|supabase:\/\/[^/]+\/[^/]+\/.+)/.test(photoUrl)) return fail("Invalid photo URL.", 400);
      if (photoUrl.includes("/object/sign/")) return fail("Invalid photo URL.", 400);
      data.photoUrl = photoUrl;
    }
    if (body.photoUrl === null) data.photoUrl = null;
    const gender = cleanStr(body.gender, 16);
    if (gender !== undefined) {
      if (!GENDERS.includes(gender.toLowerCase())) return fail("Gender must be male, female, or other.", 400);
      data.gender = gender.toLowerCase();
    }
    const address = cleanStr(body.address, 300);
    if (address !== undefined) data.address = address;
    if (body.address === null) data.address = null;
    const city = cleanStr(body.city, 80);
    if (city !== undefined) data.city = city;
    const school = cleanStr(body.school, 120);
    if (school !== undefined) data.school = school;
    const className = cleanStr(body.className, 40);
    if (className !== undefined) data.className = className;
    const parentName = cleanStr(body.parentName, 80);
    if (parentName !== undefined) data.parentName = parentName;
    const parentMobile = cleanStr(body.parentMobile, 20);
    if (parentMobile !== undefined) {
      if (!/^[+\d][\d\s-]{6,18}$/.test(parentMobile)) return fail("Invalid parent mobile number.", 400);
      data.parentMobile = parentMobile;
    }
    // Ignore unknown keys silently (forward-compatible); allowlist enforced.
    void STUDENT_EDITABLE_FIELDS;
    if (Object.keys(data).length === 0) return fail("No editable fields provided.", 400);
    const updated = await db.student.update({ where: { id: scoped.id }, data });
    // Keep the linked User name in sync (display name only — no credentials).
    if (data.name && scoped.userId) {
      await db.user.update({ where: { id: scoped.userId }, data: { name: data.name } }).catch(() => null);
    }
    return ok({ item: sanitizeStudent(updated) });
  } catch (err) {
    return serverError("students:profile-update", err);
  }
}
