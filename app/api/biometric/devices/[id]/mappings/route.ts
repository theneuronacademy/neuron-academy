// Biometric enrollment mappings — ADMIN-only.
// GET  /api/biometric/devices/[id]/mappings — list mappings with record labels.
// POST /api/biometric/devices/[id]/mappings — create { biometricUserId,
//        userType: STUDENT|FACULTY, userKey } (display code or email,
//        resolved server-side to the canonical record id).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { resolveMappingTarget } from "@/lib/biometric-ingest";

export const dynamic = "force-dynamic";

const USER_TYPES = ["STUDENT", "FACULTY"] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Listing biometric mappings");
  const { id } = await params;
  try {
    const device = await db.biometricDevice.findUnique({ where: { id }, select: { id: true } });
    if (!device) return fail(`Biometric device with id "${id}" not found.`, 404);
    const rows = await db.biometricUserMap.findMany({
      where: { deviceId: id },
      orderBy: { biometricUserId: "asc" },
      take: 200,
    });
    const mappings = await Promise.all(
      rows.map(async (m: { id: string; biometricUserId: string; userType: string; userId: string; isActive: boolean; updatedAt: Date }) => {
        let label: string | null = null;
        try {
          if (m.userType === "STUDENT") {
            const s = await db.student.findUnique({
              where: { id: m.userId },
              select: { name: true, studentId: true, status: true },
            });
            if (s) label = `${s.name} (${s.studentId}, ${s.status})`;
          } else {
            const f = await db.faculty.findUnique({
              where: { id: m.userId },
              select: { name: true, facultyId: true, status: true },
            });
            if (f) label = `${f.name} (${f.facultyId}, ${f.status})`;
          }
        } catch {
          label = null;
        }
        return { ...m, label };
      })
    );
    return ok({ mappings });
  } catch (err) {
    return serverError("biometric:mappings:list", err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Creating biometric mapping");
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const biometricUserId = typeof body.biometricUserId === "string" ? body.biometricUserId.trim() : "";
  const userType = typeof body.userType === "string" ? body.userType.trim().toUpperCase() : "";
  const userKey = typeof body.userKey === "string" ? body.userKey.trim() : "";
  if (!biometricUserId) return fail("biometricUserId must not be empty.", 400);
  if (!(USER_TYPES as readonly string[]).includes(userType)) {
    return fail("userType must be STUDENT or FACULTY.", 400);
  }
  if (!userKey) return fail("userKey must not be empty (Student/Faculty ID or email).", 400);

  try {
    const device = await db.biometricDevice.findUnique({ where: { id }, select: { id: true } });
    if (!device) return fail(`Biometric device with id "${id}" not found.`, 404);

    const target = await resolveMappingTarget(
      db,
      userType as "STUDENT" | "FACULTY",
      userKey
    );
    if (!target.ok) return fail(target.error, 404);

    const created = await db.biometricUserMap.create({
      data: {
        deviceId: id,
        biometricUserId,
        userType: userType as "STUDENT" | "FACULTY",
        userId: target.userId,
      },
    });
    return ok({ item: created, label: target.label }, 201);
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = err as any;
    if (error?.code === "P2002") {
      return fail(
        `Biometric ID "${biometricUserId}" is already mapped on this device. Delete or edit the existing mapping first.`,
        409
      );
    }
    return serverError("biometric:mapping:create", err);
  }
}
