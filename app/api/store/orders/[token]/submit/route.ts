// Store — the buyer reports that they have paid (public, keyed by the
// private order token). Moves the order to SUBMITTED for admin verification.
// It never unlocks the download: only an admin can mark an order PAID.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { cleanPaymentRef, isAccessToken } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isAccessToken(token)) return fail("Order not found.", 404);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating an order");
  const limit = checkRateLimit(token, { windowMs: 60 * 60 * 1000, maxRequests: 10, keyPrefix: "store:submit" });
  if (!limit.allowed) return fail("Too many attempts. Please try again later.", 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request.", 400);
  }
  const paymentRef = cleanPaymentRef(body.paymentRef);
  if (!paymentRef) return fail("Enter the transaction / UTR number shown in your payment app (6 to 40 letters or digits).", 400);

  try {
    const order = await db.storeOrder.findUnique({ where: { accessToken: token }, select: { id: true, status: true } });
    if (!order) return fail("Order not found.", 404);
    if (order.status === "PAID") return ok({ status: "PAID" });
    if (order.status === "CANCELLED") return fail("This order was cancelled. Please place a new order or contact the academy.", 409);
    await db.storeOrder.update({ where: { id: order.id }, data: { status: "SUBMITTED", paymentRef } });
    return ok({ status: "SUBMITTED" });
  } catch (err) {
    return serverError("store:order:submit", err);
  }
}
