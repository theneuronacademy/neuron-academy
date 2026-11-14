// Store — download for a PAID order (public, keyed by the private order
// token). Sends the buyer to the file; any other state returns them to
// their order page. Files in private storage get a short-lived signed URL.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { resolveStorageUrl } from "@/lib/storageProvider";
import { isAccessToken } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Signed links to privately stored files stay valid for five minutes. */
const DOWNLOAD_URL_TTL_SEC = 300;

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const home = new URL("/store", req.url);
  if (!isAccessToken(token)) return noStore(NextResponse.redirect(home, 302));
  const orderPage = new URL(`/store/order/${token}`, req.url);
  const db = getDb();
  if (!db) return noStore(NextResponse.redirect(orderPage, 302));
  try {
    const order = await db.storeOrder.findUnique({
      where: { accessToken: token },
      select: { id: true, status: true, book: { select: { pdfUrl: true, externalUrl: true } } },
    });
    if (!order) return noStore(NextResponse.redirect(home, 302));
    if (order.status !== "PAID") return noStore(NextResponse.redirect(orderPage, 302));

    const stored = order.book.pdfUrl ? await resolveStorageUrl(order.book.pdfUrl, DOWNLOAD_URL_TTL_SEC) : null;
    const target = stored || order.book.externalUrl;
    if (!target) {
      orderPage.searchParams.set("problem", "file");
      return noStore(NextResponse.redirect(orderPage, 302));
    }
    await db.storeOrder.update({ where: { id: order.id }, data: { downloadCount: { increment: 1 }, lastDownloadAt: new Date() } });
    // Locally stored files are site-relative paths; everything else is absolute.
    return noStore(NextResponse.redirect(new URL(target, req.url), 302));
  } catch (err) {
    console.error("[api:store:download]", err);
    orderPage.searchParams.set("problem", "server");
    return noStore(NextResponse.redirect(orderPage, 302));
  }
}
