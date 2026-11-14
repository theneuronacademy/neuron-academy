// Store — send the buyer to Razorpay to pay for their order (public, keyed
// by the private order token). Creates the order's payment link on first use
// and reuses it afterwards. Payment is confirmed on the way back, by asking
// Razorpay directly (see ../../../pay/return).

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { createGatewayLink, gatewayEnabled, gatewayReference, syncGatewayPayment } from "@/lib/razorpay";
import { isAccessToken } from "@/lib/store";

export const dynamic = "force-dynamic";

function go(url: URL | string): NextResponse {
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isAccessToken(token)) return go(new URL("/store", req.url));
  const orderPage = new URL(`/store/order/${token}`, req.url);
  const problem = (code: string) => {
    orderPage.searchParams.set("problem", code);
    return go(orderPage);
  };
  const db = getDb();
  if (!db || !gatewayEnabled()) return go(orderPage);
  const limit = checkRateLimit(getClientIp(req), { windowMs: 10 * 60 * 1000, maxRequests: 20, keyPrefix: "store:pay" });
  if (!limit.allowed) return problem("busy");

  try {
    const order = await db.storeOrder.findUnique({ where: { accessToken: token } });
    if (!order || order.status === "PAID" || order.status === "CANCELLED") return go(orderPage);

    // An earlier link: maybe it was paid already, maybe it can still be used.
    if (order.gatewayLinkId) {
      const { paid, link } = await syncGatewayPayment(db, order);
      if (paid) return go(orderPage);
      if (!link) return problem("pay");
      if (link.status === "created") return go(link.url);
    }

    const referenceId = gatewayReference(order.orderNo, Boolean(order.gatewayRef));
    const link = await createGatewayLink({
      amountRupees: order.amount,
      referenceId,
      description: `${order.bookTitle} (Order ${order.orderNo})`,
      customerName: order.buyerName,
      customerMobile: order.buyerMobile,
      customerEmail: order.buyerEmail,
      callbackUrl: new URL("/api/store/pay/return", req.url).toString(),
    });
    // Only replace the link this request started from; if another request
    // got there first, use the one it stored.
    const saved = await db.storeOrder.updateMany({
      where: { id: order.id, gatewayLinkId: order.gatewayLinkId, status: { in: ["PENDING", "SUBMITTED"] } },
      data: { gatewayLinkId: link.id, gatewayLinkUrl: link.url, gatewayRef: referenceId },
    });
    if (saved.count === 0) {
      const now = await db.storeOrder.findUnique({ where: { id: order.id }, select: { status: true, gatewayLinkUrl: true } });
      return now?.gatewayLinkUrl && now.status !== "PAID" && now.status !== "CANCELLED" ? go(now.gatewayLinkUrl) : go(orderPage);
    }
    return go(link.url);
  } catch (err) {
    console.error("[api:store:pay]", err instanceof Error ? err.message : err);
    // A double tap makes Razorpay reject the second, identical reference:
    // the first request's link is the one to use.
    try {
      const now = await db.storeOrder.findUnique({ where: { accessToken: token }, select: { status: true, gatewayLinkUrl: true } });
      if (now?.gatewayLinkUrl && (now.status === "PENDING" || now.status === "SUBMITTED")) return go(now.gatewayLinkUrl);
    } catch {
      /* fall through */
    }
    return problem("pay");
  }
}
