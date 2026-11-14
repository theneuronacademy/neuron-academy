// Digital material store — shared server-side rules.
//
// How a purchase works:
//   1. A visitor places an order for a paid Book  → StoreOrder PENDING.
//   2. They pay the academy directly (payment link and/or UPI) and report the
//      transaction reference                      → SUBMITTED.
//   3. An admin checks the money arrived and marks the order paid → PAID.
//   4. Only a PAID order can fetch the file, through its private order link.
//
// Nothing here talks to a payment gateway: the academy receives the money in
// its own account and confirms each payment by hand.

import { randomBytes, randomInt } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { normalizePhone } from "@/lib/credentials";

export const STORE_STATUSES = ["PENDING", "SUBMITTED", "PAID", "CANCELLED"] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

export const MAX_PRICE = 100000; // rupees — guards against typing mistakes

/** Whole rupees within a sane range, or null. */
export function cleanPrice(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const whole = Math.round(n);
  return whole >= 1 && whole <= MAX_PRICE ? whole : null;
}

/** An https link, or null. Payment and sample links must never be anything else. */
export function cleanHttpsUrl(v: unknown, max = 1000): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  if (!/^https:\/\/[^\s<>"']+$/i.test(s)) return null;
  try {
    return new URL(s).protocol === "https:" ? s : null;
  } catch {
    return null;
  }
}

/** A UPI address such as `name@bank`, or null. */
export function cleanUpiId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(s) ? s : null;
}

/** Indian mobile as +91XXXXXXXXXX, or null. */
export function cleanMobile(v: unknown): string | null {
  const p = normalizePhone(v);
  return p && /^\+91[6-9]\d{9}$/.test(p) ? p : null;
}

export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s.length >= 2 && s.length <= 80 && !/[<>]/.test(s) ? s : null;
}

/** Bank / UPI transaction reference as typed by the buyer (letters and digits only). */
export function cleanPaymentRef(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{6,40}$/.test(s) ? s : null;
}

// No 0/O/1/I/L so a reference read out over the phone is unambiguous.
const ORDER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newOrderNo(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)];
  return `NA-${s}`;
}

/** Unguessable key for the buyer's private order link (192 bits). */
export function newAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export function isAccessToken(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{32}$/.test(v);
}

export interface StorePaymentSettings {
  upiId: string | null;
  payeeName: string | null;
  paymentLink: string | null;
  instructions: string | null;
}

export const EMPTY_SETTINGS: StorePaymentSettings = { upiId: null, payeeName: null, paymentLink: null, instructions: null };

export async function loadStoreSettings(db: PrismaClient): Promise<StorePaymentSettings> {
  const row = await db.storeSettings.findUnique({ where: { id: "default" } });
  if (!row) return EMPTY_SETTINGS;
  return { upiId: row.upiId, payeeName: row.payeeName, paymentLink: row.paymentLink, instructions: row.instructions };
}

/**
 * `upi://pay` link carrying the amount and the order number, so the payment
 * arrives labelled. Opens the buyer's UPI app on a phone; shown as a QR code
 * for scanning otherwise.
 */
export function upiPayUri(settings: StorePaymentSettings, amount: number, orderNo: string): string | null {
  if (!settings.upiId) return null;
  const q = new URLSearchParams({
    pa: settings.upiId,
    pn: settings.payeeName || "Neuron Academy",
    am: amount.toFixed(2),
    cu: "INR",
    tn: `Order ${orderNo}`,
  });
  return `upi://pay?${q.toString()}`;
}

/** Can a buyer actually pay for and receive this item? */
export function isSellable(
  book: { isActive: boolean; isPaid: boolean; price: number | null; pdfUrl: string | null; externalUrl: string | null; paymentLink: string | null },
  settings: StorePaymentSettings
): boolean {
  const hasFile = Boolean(book.pdfUrl || book.externalUrl);
  const hasWayToPay = Boolean(book.paymentLink || settings.paymentLink || settings.upiId);
  return book.isActive && book.isPaid && typeof book.price === "number" && book.price > 0 && hasFile && hasWayToPay;
}

/**
 * The public view of a book. For a paid item the file locations and the raw
 * payment link are removed: the file is released only through a paid order.
 */
export function publicBook<T extends { isPaid: boolean; pdfUrl: string | null; externalUrl: string | null }>(book: T): T {
  if (!book.isPaid) return book;
  return { ...book, pdfUrl: null, externalUrl: null, cachedPdfUrl: null, paymentLink: null };
}

/**
 * Sale settings from a create/update body. Only fields present in the body
 * are returned; `current` supplies the stored values a partial update is
 * checked against (a paid item must always have a price).
 */
export function parseSaleFields(
  body: Record<string, unknown>,
  current: { isPaid: boolean; price: number | null }
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const data: Record<string, unknown> = {};
  if (typeof body.isPaid === "boolean") data.isPaid = body.isPaid;
  if (body.price !== undefined) {
    const empty = body.price === null || body.price === "";
    const price = empty ? null : cleanPrice(body.price);
    if (!empty && price === null) return { ok: false, error: "Price should be a whole number of rupees between 1 and 1,00,000." };
    data.price = price;
  }
  if (body.mrp !== undefined) {
    const empty = body.mrp === null || body.mrp === "";
    const mrp = empty ? null : cleanPrice(body.mrp);
    if (!empty && mrp === null) return { ok: false, error: "MRP should be a whole number of rupees." };
    data.mrp = mrp;
  }
  for (const key of ["paymentLink", "sampleUrl"] as const) {
    if (body[key] === undefined) continue;
    const empty = body[key] === null || (typeof body[key] === "string" && (body[key] as string).trim() === "");
    const url = empty ? null : cleanHttpsUrl(body[key]);
    if (!empty && url === null) return { ok: false, error: `${key === "paymentLink" ? "Payment link" : "Sample link"} must start with https://` };
    data[key] = url;
  }
  const isPaid = (data.isPaid as boolean | undefined) ?? current.isPaid;
  const price = data.price !== undefined ? (data.price as number | null) : current.price;
  if (isPaid && !price) return { ok: false, error: "Set a price to sell this item." };
  const mrp = data.mrp as number | null | undefined;
  if (mrp && price && mrp <= price) return { ok: false, error: "MRP should be higher than the selling price, or left empty." };
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// Catalogue for the public store pages (server components)
// ---------------------------------------------------------------------------

export interface StoreItem {
  id: string;
  title: string;
  description: string;
  author: string;
  subject: string;
  className: string;
  category: string;
  coverImageUrl: string;
  price: number;
  mrp: number | null;
  sampleUrl: string | null;
  /** False when the item cannot be bought online yet (no file or no way to pay). */
  sellable: boolean;
}

type BookRow = {
  id: string; title: string; description: string | null; author: string | null; subject: string | null;
  className: string | null; category: string | null; coverImageUrl: string | null; pdfUrl: string | null;
  externalUrl: string | null; isActive: boolean; isPaid: boolean; price: number | null; mrp: number | null;
  paymentLink: string | null; sampleUrl: string | null;
};

async function toStoreItem(b: BookRow, settings: StorePaymentSettings): Promise<StoreItem> {
  const { resolveCoverUrl } = await import("@/lib/storageProvider");
  return {
    id: b.id,
    title: b.title,
    description: b.description ?? "",
    author: b.author ?? "",
    subject: b.subject ?? "",
    className: b.className ?? "",
    category: b.category ?? "",
    coverImageUrl: (await resolveCoverUrl(b.coverImageUrl)) ?? "",
    price: b.price as number,
    mrp: b.mrp && b.price && b.mrp > b.price ? b.mrp : null,
    sampleUrl: b.sampleUrl,
    sellable: isSellable(b, settings),
  };
}

/** Active paid items, in the admin's display order. Null when the database is unavailable. */
export async function getStoreItems(db: PrismaClient | null): Promise<StoreItem[] | null> {
  if (!db) return null;
  try {
    const [rows, settings] = await Promise.all([
      db.book.findMany({ where: { isActive: true, isPaid: true, price: { gt: 0 } }, orderBy: [{ order: "asc" }, { createdAt: "desc" }], take: 200 }),
      loadStoreSettings(db),
    ]);
    return await Promise.all(rows.map((b) => toStoreItem(b, settings)));
  } catch {
    return null;
  }
}

/** One active paid item, or null. */
export async function getStoreItem(db: PrismaClient | null, id: string): Promise<StoreItem | null> {
  if (!db || !/^[a-z0-9]{10,40}$/i.test(id)) return null;
  try {
    const [b, settings] = await Promise.all([db.book.findUnique({ where: { id } }), loadStoreSettings(db)]);
    if (!b || !b.isActive || !b.isPaid || !b.price || b.price <= 0) return null;
    return await toStoreItem(b, settings);
  } catch {
    return null;
  }
}

/**
 * The store pages are cached; refresh them as soon as an admin changes an
 * item or the payment settings, so the change is visible straight away.
 */
export async function refreshStorePages(bookId?: string): Promise<void> {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/store");
    if (bookId) revalidatePath(`/store/${bookId}`);
    else revalidatePath("/store/[id]", "page");
  } catch {
    /* outside a request (scripts, tests): nothing to refresh */
  }
}
