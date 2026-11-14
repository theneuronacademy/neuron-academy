// Store — find an order again (public). Needs both the order number and the
// mobile number used at purchase; a mismatch gives the same answer as an
// unknown order.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { cleanMobile } from "@/lib/store";

export const dynamic = "force-dynamic";

const NOT_FOUND = "No order matches that order number and mobile number.";

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Finding an order");
  const limit = checkRateLimit(getClientIp(req), { windowMs: 60 * 60 * 1000, maxRequests: 10, keyPrefix: "store:lookup" });
  if (!limit.allowed) return fail("Too many attempts. Please try again later.", 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request.", 400);
  }
  const raw = typeof body.orderNo === "string" ? body.orderNo.trim().toUpperCase().replace(/\s+/g, "") : "";
  const orderNo = /^NA-?[A-Z0-9]{6}$/.test(raw) ? `NA-${raw.replace(/^NA-?/, "")}` : null;
  const mobile = cleanMobile(body.mobile);
  if (!orderNo || !mobile) return fail(NOT_FOUND, 404);

  try {
    const order = await db.storeOrder.findUnique({ where: { orderNo }, select: { accessToken: true, buyerMobile: true } });
    if (!order || order.buyerMobile !== mobile) return fail(NOT_FOUND, 404);
    return ok({ token: order.accessToken });
  } catch (err) {
    return serverError("store:order:lookup", err);
  }
}
