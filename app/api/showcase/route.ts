// Homepage results-showcase CMS (toppers wall).
// GET is public but serves ONLY consented + active rows, ordered for display.
// Writes are ADMIN-only. Publication requires explicit consent (see below):
// a row goes public only when consent AND isActive are both true, so an
// identifiable student name/photo is never published by accident.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { getUserFromRequest } from "@/lib/session";
import { isNonEmpty, missingFields } from "@/lib/validation";
import { activationAllowed, showcaseValidation } from "@/lib/showcase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return ok({ items: [], source: "demo" });
  const viewer = getUserFromRequest(req);
  try {
    const rows = await db.resultShowcase.findMany({
      where: viewer?.role === "ADMIN" ? {} : { isActive: true, consent: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("showcase:list", err);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Publishing a result");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const missing = missingFields(body, ["studentName", "achievement"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);
  const invalid = showcaseValidation(body);
  if (invalid) return fail(invalid, 400);
  const consent = body.consent === true;
  const isActive = body.isActive === true;
  if (!activationAllowed(consent, isActive)) {
    return fail("Publishing requires confirmed consent for the student's name/photo.", 400);
  }
  try {
    const created = await db.resultShowcase.create({
      data: {
        studentName: String(body.studentName).trim(),
        exam: isNonEmpty(body.exam) ? String(body.exam).trim() : "JEE Main",
        achievement: String(body.achievement).trim(),
        score: isNonEmpty(body.score) ? String(body.score).trim() : undefined,
        year: body.year !== undefined && body.year !== "" ? String(body.year).trim() : "",
        description: isNonEmpty(body.description) ? String(body.description).trim() : undefined,
        imageUrl: isNonEmpty(body.imageUrl) ? String(body.imageUrl).trim() : undefined,
        displayOrder: Number.isFinite(Number(body.displayOrder)) ? Math.floor(Number(body.displayOrder)) : 0,
        consent,
        isActive,
      },
    });
    return ok({ item: created }, 201);
  } catch (err) {
    return serverError("showcase:create", err);
  }
}
