// Phase 3 — Banner detail API.
// Writes enforce ADMIN role via requireApiRole (lib/server-auth.ts).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { parseDate } from "@/lib/validation";
import { toBannerAnimation } from "@/components/website/bannerMotion";

export const dynamic = "force-dynamic";

function patch(body: Record<string, unknown>) {
  return {
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(typeof body.subtitle === "string" ? { subtitle: body.subtitle } : {}),
    ...(typeof body.description === "string" ? { description: body.description } : {}),
    ...(typeof body.imageUrl === "string" ? { imageUrl: body.imageUrl } : {}),
    ...(typeof body.videoUrl === "string" ? { videoUrl: body.videoUrl } : {}),
    ...(typeof body.buttonText === "string" ? { buttonText: body.buttonText } : {}),
    ...(typeof body.buttonUrl === "string" ? { buttonUrl: body.buttonUrl } : {}),
    // Motion/animation style — validates against the shared vocabulary.
    ...(typeof body.animation === "string" ? { animation: toBannerAnimation(body.animation) } : {}),
    ...(body.startDate !== undefined ? { startDate: parseDate(body.startDate) ?? null } : {}),
    ...(body.endDate !== undefined ? { endDate: parseDate(body.endDate) ?? null } : {}),
    ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
    ...(typeof body.displayOrder === "number" ? { displayOrder: body.displayOrder } : {}),
  };
}

/** Rebuild the patch payload without the animation field (P2022 fallback). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function patchWithoutAnimation(patchData: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { animation: _a, ...rest } = patchData as Record<string, any>;
  void _a;
  return rest;
}

const isMissingAnimationColumn = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("P2022") || msg.toLowerCase().includes("animation");
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return dbNotConfigured("Reading a banner");
  try {
    const row = await db.banner.findUnique({ where: { id } });
    if (!row) return fail("Banner not found.", 404);
    return ok({ item: row });
  } catch (err) {
    if (isMissingAnimationColumn(err)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = await (db as any).banner.findUnique({
          where: { id },
          select: {
            id: true, title: true, subtitle: true, description: true,
            imageUrl: true, videoUrl: true, buttonText: true, buttonUrl: true,
            startDate: true, endDate: true, isActive: true, displayOrder: true,
            createdAt: true, updatedAt: true,
          },
        });
        if (!row) return fail("Banner not found.", 404);
        return ok({ item: { ...row, animation: "none" } });
      } catch (err2) {
        return serverError("banners:get", err2);
      }
    }
    return serverError("banners:get", err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating a banner");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  try {
    const row = await db.banner.update({ where: { id }, data: patch(body) });
    return ok({ item: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Banner not found.", 404);
    if (isMissingAnimationColumn(err)) {
      // animation column not migrated yet — save everything but animation
      // so the rest of the edit still persists.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = await (db as any).banner.update({ where: { id }, data: patchWithoutAnimation(patch(body)) });
        return ok({ item: { ...row, animation: "none" }, warning: "Animation style could not be saved yet (migration pending); the rest of the banner was saved." });
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : "";
        if (msg2.includes("P2025")) return fail("Banner not found.", 404);
        return serverError("banners:update", err2);
      }
    }
    return serverError("banners:update", err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Deleting a banner");
  try {
    await db.banner.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P2025")) return fail("Banner not found.", 404);
    return serverError("banners:delete", err);
  }
}
