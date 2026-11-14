// Store — admin actions on one order (ADMIN only).
// Marking an order paid is the only thing that unlocks its download.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { cleanPaymentRef } from "@/lib/store";

export const dynamic = "force-dynamic";

const ACTIONS = ["markPaid", "cancel", "reopen", "note"] as const;
type Action = (typeof ACTIONS)[number];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Updating an order");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const action = ACTIONS.includes(body.action as Action) ? (body.action as Action) : null;
  if (!action) return fail("Unknown action.", 400);
  const refRaw = typeof body.paymentRef === "string" && body.paymentRef.trim() !== "" ? body.paymentRef : null;
  const paymentRef = refRaw ? cleanPaymentRef(refRaw) : null;
  if (refRaw && !paymentRef) return fail("The payment reference should be 6 to 40 letters or digits.", 400);
  const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim().slice(0, 500) || null : undefined;

  try {
    const order = await db.storeOrder.findUnique({ where: { id }, select: { id: true, status: true, paymentRef: true } });
    if (!order) return fail("Order not found.", 404);

    const data: Record<string, unknown> = {};
    if (adminNote !== undefined) data.adminNote = adminNote;
    if (paymentRef) data.paymentRef = paymentRef;
    if (action === "markPaid") {
      if (order.status === "PAID") return fail("This order is already marked paid.", 409);
      Object.assign(data, { status: "PAID", paidAt: new Date(), verifiedBy: auth.user.name || auth.user.email });
    } else if (action === "cancel") {
      if (order.status === "CANCELLED") return fail("This order is already cancelled.", 409);
      Object.assign(data, { status: "CANCELLED" });
    } else if (action === "reopen") {
      // Back to waiting: "reported" if the buyer gave a reference, otherwise "not paid yet".
      Object.assign(data, { status: paymentRef || order.paymentRef ? "SUBMITTED" : "PENDING", paidAt: null, verifiedBy: null });
    }
    const item = await db.storeOrder.update({ where: { id }, data });
    return ok({ item });
  } catch (err) {
    return serverError("admin-store:orders:update", err);
  }
}
