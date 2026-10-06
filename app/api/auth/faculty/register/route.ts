// Phase 10 — faculty registration (approval-gated).
// Creates User(FACULTY, INACTIVE) + Faculty(INACTIVE). No session is issued:
// an ADMIN must approve (PATCH /api/faculty/[id] { isActive: true }) first.
// Never grants ADMIN.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { isAuthConfigured } from "@/lib/session";
import { hashPassword, isValidPassword, normalizePhone } from "@/lib/credentials";
import { isEmail, missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

function facultyId(): string {
  return `FAC-${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Faculty registration");
  if (!isAuthConfigured()) return fail("Registration needs SESSION_SECRET.", 503);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["name", "phone", "email", "password"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  const name = String(body.name).trim();
  if (name.length < 2 || name.length > 80) return fail("Name must be 2–80 characters.", 400);
  const phone = normalizePhone(body.phone);
  if (!phone) return fail("Invalid mobile number.", 400);
  const email = String(body.email).trim().toLowerCase();
  if (!isEmail(email)) return fail("Invalid email.", 400);
  if (!isValidPassword(body.password)) return fail("Password must be 8–128 characters.", 400);
  try {
    if (await db.faculty.findFirst({ where: { phone }, select: { id: true } })) {
      return fail("This mobile number is already registered.", 409);
    }
    if (await db.faculty.findUnique({ where: { email }, select: { id: true } })) {
      return fail("This email is already registered.", 409);
    }
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      return fail("This email is already registered.", 409);
    }
    let fid = facultyId();
    for (let i = 0; i < 5; i++) {
      if (!(await db.faculty.findUnique({ where: { facultyId: fid }, select: { id: true } }))) break;
      fid = facultyId();
    }
    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash: await hashPassword(String(body.password)),
        role: "FACULTY",
        isActive: false, // pending ADMIN approval
      },
    });
    await db.faculty.create({
      data: {
        userId: user.id,
        facultyId: fid,
        name,
        email,
        phone,
        qualification: typeof body.qualification === "string" ? body.qualification : undefined,
        subject: typeof body.subject === "string" ? body.subject : undefined,
        status: "INACTIVE", // pending ADMIN approval
      },
    });
    return ok({ message: "Registration received. Your account will be activated after admin approval." }, 201);
  } catch (err) {
    return serverError("auth:faculty-register", err);
  }
}
