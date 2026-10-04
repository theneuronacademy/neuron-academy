// Phase 3 — Faculty API. Demo fallback when DATABASE_URL is missing.
// TODO auth: enforce ADMIN role once the session layer lands.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { isEmail, isNonEmpty, isPhone, missingFields } from "@/lib/validation";
import { DEMO_FACULTY } from "@/data/admin";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAdmin(f: any) {
  return {
    id: f.id,
    name: f.name,
    photo: f.photo ?? "",
    email: f.email,
    phone: f.phone,
    subject: "—",
    qualification: f.qualification ?? "—",
    experience: f.experience ?? "—",
    batches: Array.isArray(f.batches) ? f.batches.map((b: { name?: string }) => b?.name ?? "") : [],
    status: String(f.status ?? "ACTIVE").toLowerCase() === "inactive" ? "inactive" : "active",
  };
}

export async function GET() {
  const db = getDb();
  if (!db) return ok({ items: DEMO_FACULTY, source: "demo" });
  try {
    const rows = await db.faculty.findMany({ include: { batches: true }, orderBy: { createdAt: "desc" }, take: 200 });
    return ok({ items: rows.map(toAdmin), source: "database" });
  } catch (err) {
    return serverError("faculty:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Adding faculty");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["name", "email", "phone"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  if (!isEmail(body.email)) return fail("Invalid email.", 400);
  if (!isPhone(body.phone)) return fail("Invalid phone.", 400);
  try {
    const created = await db.faculty.create({
      data: {
        facultyId: isNonEmpty(body.facultyId) ? String(body.facultyId) : `FAC-${Date.now().toString().slice(-6)}`,
        name: String(body.name),
        email: String(body.email),
        phone: String(body.phone),
        qualification: typeof body.qualification === "string" ? body.qualification : undefined,
        experience: typeof body.experience === "string" ? body.experience : undefined,
        bio: typeof body.bio === "string" ? body.bio : undefined,
      },
      include: { batches: true },
    });
    return ok({ item: toAdmin(created) }, 201);
  } catch (err) {
    return serverError("faculty:create", err);
  }
}
