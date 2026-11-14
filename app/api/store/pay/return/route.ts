// Store — where Razorpay sends the buyer after the payment page (public).
// The query string only tells us WHICH payment link to look at; whether it
// was paid is read from Razorpay itself, server to server. The buyer then
// lands on their order page, where the download is waiting if it was.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { isGatewayLinkId, syncGatewayPayment } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

function go(url: URL): NextResponse {
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export async function GET(req: NextRequest) {
  const store = new URL("/store", req.url);
  const linkId = req.nextUrl.searchParams.get("razorpay_payment_link_id");
  const db = getDb();
  if (!db || !isGatewayLinkId(linkId)) return go(store);
  try {
    const order = await db.storeOrder.findUnique({ where: { gatewayLinkId: linkId } });
    if (!order) return go(store);
    const orderPage = new URL(`/store/order/${order.accessToken}`, req.url);
    const { paid } = await syncGatewayPayment(db, order);
    if (!paid) orderPage.searchParams.set("problem", "unpaid");
    return go(orderPage);
  } catch (err) {
    console.error("[api:store:pay:return]", err instanceof Error ? err.message : err);
    return go(store);
  }
}
