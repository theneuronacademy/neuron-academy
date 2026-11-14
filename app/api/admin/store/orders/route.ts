// Store — admin order list and manual order entry (ADMIN only).

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { STORE_STATUSES, cleanMobile, cleanName, cleanPaymentRef, cleanPrice, newAccessToken, newOrderNo, type StoreStatus } from "@/lib/store";
import { isEmail } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading store orders");
  try {
    const [items, grouped, paid] = await Promise.all([
      db.storeOrder.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
      db.storeOrder.groupBy({ by: ["status"], _count: { _all: true } }),
      db.storeOrder.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    ]);
    const counts = Object.fromEntries(STORE_STATUSES.map((s) => [s, 0])) as Record<StoreStatus, number>;
    for (const g of grouped) counts[g.status as StoreStatus] = g._count._all;
    return ok({ items, counts, revenue: paid._sum.amount ?? 0, source: "database" });
  } catch (err) {
    return serverError("admin-store:orders:list", err);
  }
}

/** Record an order taken outside the website (for example paid in person or on WhatsApp). */
export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Adding an order");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const bookId = typeof body.bookId === "string" ? body.bookId.trim().slice(0, 40) : "";
  const buyerName = cleanName(body.buyerName);
  const buyerMobile = cleanMobile(body.buyerMobile);
  const emailRaw = typeof body.buyerEmail === "string" ? body.buyerEmail.trim().slice(0, 160) : "";
  if (!bookId) return fail("Choose the item.", 400);
  if (!buyerName) return fail("Enter the buyer's name.", 400);
  if (!buyerMobile) return fail("Enter a valid 10-digit mobile number.", 400);
  if (emailRaw && !isEmail(emailRaw)) return fail("Enter a valid email address, or leave it empty.", 400);
  const refRaw = typeof body.paymentRef === "string" && body.paymentRef.trim() !== "" ? body.paymentRef : null;
  const paymentRef = refRaw ? cleanPaymentRef(refRaw) : null;
  if (refRaw && !paymentRef) return fail("The payment reference should be 6 to 40 letters or digits.", 400);
  const markPaid = body.markPaid === true;

  try {
    const book = await db.book.findUnique({ where: { id: bookId } });
    if (!book || !book.isPaid) return fail("Choose an item that is set up for sale.", 400);
    if (!book.pdfUrl && !book.externalUrl) return fail("This item has no file yet. Add its PDF or link first.", 400);
    const amount = body.amount === undefined || body.amount === null || body.amount === "" ? book.price : cleanPrice(body.amount);
    if (!amount) return fail("Enter the amount received.", 400);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const item = await db.storeOrder.create({
          data: {
            orderNo: newOrderNo(),
            accessToken: newAccessToken(),
            bookId: book.id,
            bookTitle: book.title,
            amount,
            buyerName,
            buyerMobile,
            buyerEmail: emailRaw || null,
            paymentRef,
            source: "ADMIN",
            adminNote: typeof body.adminNote === "string" && body.adminNote.trim() ? body.adminNote.trim().slice(0, 500) : null,
            ...(markPaid ? { status: "PAID" as const, paidAt: new Date(), verifiedBy: auth.user.name || auth.user.email } : {}),
          },
        });
        return ok({ item }, 201);
      } catch (err) {
        const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
        if (code !== "P2002") throw err;
      }
    }
    return fail("Could not create the order. Please try again.", 503);
  } catch (err) {
    return serverError("admin-store:orders:create", err);
  }
}
