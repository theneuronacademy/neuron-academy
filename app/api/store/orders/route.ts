// Store — place an order for a paid item (public).
// Creates a PENDING StoreOrder and returns the private order token; the buyer
// then pays the academy directly and the order is verified by an admin.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { cleanMobile, cleanName, isSellable, loadStoreSettings, newAccessToken, newOrderNo } from "@/lib/store";
import { isEmail } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return dbNotConfigured("Placing an order");
  const limit = checkRateLimit(getClientIp(req), { windowMs: 60 * 60 * 1000, maxRequests: 8, keyPrefix: "store:order" });
  if (!limit.allowed) return fail("Too many orders from this connection. Please try again later.", 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request.", 400);
  }
  const bookId = typeof body.bookId === "string" ? body.bookId.trim().slice(0, 40) : "";
  const buyerName = cleanName(body.name);
  const buyerMobile = cleanMobile(body.mobile);
  const emailRaw = typeof body.email === "string" ? body.email.trim().slice(0, 160) : "";
  if (!bookId) return fail("Choose an item to buy.", 400);
  if (!buyerName) return fail("Please enter your name.", 400);
  if (!buyerMobile) return fail("Please enter a valid 10-digit mobile number.", 400);
  if (emailRaw && !isEmail(emailRaw)) return fail("Please enter a valid email address, or leave it empty.", 400);

  try {
    const [book, settings] = await Promise.all([db.book.findUnique({ where: { id: bookId } }), loadStoreSettings(db)]);
    if (!book || !isSellable(book, settings)) return fail("This item is not available to buy right now.", 404);

    // The short order number is random; on the rare clash, draw again.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const order = await db.storeOrder.create({
          data: {
            orderNo: newOrderNo(),
            accessToken: newAccessToken(),
            bookId: book.id,
            bookTitle: book.title,
            amount: book.price as number,
            buyerName,
            buyerMobile,
            buyerEmail: emailRaw || null,
          },
          select: { accessToken: true, orderNo: true },
        });
        return ok({ token: order.accessToken, orderNo: order.orderNo }, 201);
      } catch (err) {
        const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
        if (code !== "P2002") throw err;
      }
    }
    return fail("Could not place the order. Please try again.", 503);
  } catch (err) {
    return serverError("store:order:create", err);
  }
}
