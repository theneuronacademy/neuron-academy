// Store — how buyers pay the academy (ADMIN only): UPI ID, payee name,
// a default payment link and a short instruction shown at checkout.

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { cleanHttpsUrl, cleanUpiId, loadStoreSettings, refreshStorePages } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Reading store settings");
  try {
    return ok({ item: await loadStoreSettings(db) });
  } catch (err) {
    return serverError("admin-store:settings:read", err);
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Saving store settings");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const upiRaw = text(body.upiId, 320);
  const upiId = upiRaw ? cleanUpiId(upiRaw) : null;
  if (upiRaw && !upiId) return fail("The UPI ID should look like name@bank.", 400);
  const linkRaw = text(body.paymentLink, 1000);
  const paymentLink = linkRaw ? cleanHttpsUrl(linkRaw) : null;
  if (linkRaw && !paymentLink) return fail("The payment link must start with https://", 400);
  const payeeName = text(body.payeeName, 80);
  if (payeeName && /[<>&]/.test(payeeName)) return fail("The payee name has characters that are not allowed.", 400);
  const data = { upiId, payeeName, paymentLink, instructions: text(body.instructions, 600) };
  try {
    const row = await db.storeSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    await refreshStorePages();
    return ok({ item: { upiId: row.upiId, payeeName: row.payeeName, paymentLink: row.paymentLink, instructions: row.instructions } });
  } catch (err) {
    return serverError("admin-store:settings:save", err);
  }
}
