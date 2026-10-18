// Faculty Gradebook Config API - Get/Save gradebook category configuration
import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { facultyBatchIds } from "@/lib/testAccess";
import { missingFields } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface Category {
  id: string;
  name: string;
  weight: number;
  color: string;
}

function toJson(categories: Category[]): unknown {
  return categories;
}

function fromJson(json: unknown): Category[] {
  return json as Category[];
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading gradebook config");

  const { id } = await params; // batchId

  try {
    // Verify faculty access
    if (auth.user.role === "FACULTY") {
      const allowed = await facultyBatchIds(db, auth.user.id);
      if (!allowed.includes(id)) return fail("Forbidden: batch not assigned to you.", 403);
    }

    const config = await db.gradebookConfig.findUnique({
      where: { batchId: id },
      select: { categories: true },
    });

    if (!config) {
      // Return default categories
      return ok({
        categories: [
          { id: "attendance", name: "Attendance", weight: 15, color: "#10B981" },
          { id: "assignments", name: "Assignments", weight: 25, color: "#3B82F6" },
          { id: "tests", name: "Tests", weight: 40, color: "#8B5CF6" },
          { id: "participation", name: "Participation", weight: 20, color: "#F59E0B" },
        ],
      });
    }

    return ok({ categories: fromJson(config.categories) });
  } catch (err) {
    return serverError("gradebook:config:get", err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Saving gradebook config");

  const { id } = await params; // batchId

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const missing = missingFields(body, ["categories"]);
  if (missing.length > 0) return fail(`Missing required fields: ${missing.join(", ")}.`, 400);

  const categories = body.categories as Category[];

  // Validate categories
  if (!Array.isArray(categories) || categories.length === 0) {
    return fail("At least one category is required.", 400);
  }

  const totalWeight = categories.reduce((sum, c) => sum + (c.weight || 0), 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    return fail("Category weights must sum to 100%.", 400);
  }

  for (const cat of categories) {
    if (!cat.id || !cat.name || typeof cat.weight !== "number" || !cat.color) {
      return fail("Each category must have id, name, weight (number), and color.", 400);
    }
    if (cat.weight <= 0 || cat.weight > 100) {
      return fail("Category weight must be between 0 and 100.", 400);
    }
  }

  // Verify faculty access
  if (auth.user.role === "FACULTY") {
    const allowed = await facultyBatchIds(db, auth.user.id);
    if (!allowed.includes(id)) return fail("Forbidden: batch not assigned to you.", 403);
  }

  try {
    const config = await db.gradebookConfig.upsert({
      where: { batchId: id },
      update: { categories: toJson(categories) },
      create: {
        batchId: id,
        categories: toJson(categories),
      },
    });

    return ok({ config: { categories: fromJson(config.categories) } });
  } catch (err) {
    return serverError("gradebook:config:save", err);
  }
}