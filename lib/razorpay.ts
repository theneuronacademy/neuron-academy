// Razorpay Payment Links — the automatic way to pay in the store.
//
// The academy's Razorpay keys live only in server environment variables
// (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET). An order is marked paid only
// after this server asks Razorpay directly whether its payment link was
// paid; nothing the buyer's browser sends is trusted for that.

import { randomInt } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const DEFAULT_API_BASE = "https://api.razorpay.com";
const TIMEOUT_MS = 12000;

function keys(): { id: string; secret: string } | null {
  const id = process.env.RAZORPAY_KEY_ID?.trim();
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return id && secret ? { id, secret } : null;
}

/** True when both Razorpay keys are configured on the server. */
export function gatewayEnabled(): boolean {
  return keys() !== null;
}

/** "test" or "live", read from the key id prefix; null when not configured. */
export function gatewayMode(): "test" | "live" | null {
  const k = keys();
  if (!k) return null;
  return k.id.startsWith("rzp_test_") ? "test" : "live";
}

function apiBase(): string {
  // Overridable so automated tests can point at a local stand-in.
  return (process.env.RAZORPAY_API_BASE?.trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
}

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
  const k = keys();
  if (!k) throw new Error("Razorpay is not configured");
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${k.id}:${k.secret}`).toString("base64")}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json) {
    const err = json && typeof json.error === "object" && json.error ? (json.error as { description?: unknown }).description : null;
    throw new Error(`Razorpay ${method} ${path.replace(/plink_\w+/, "plink_…")} failed (${res.status})${typeof err === "string" ? `: ${err}` : ""}`);
  }
  return json;
}

export interface GatewayLink {
  id: string;
  url: string;
  /** created | partially_paid | paid | expired | cancelled */
  status: string;
  /** In paise. */
  amount: number;
  amountPaid: number;
  referenceId: string;
  paymentId: string | null;
}

function toLink(j: Record<string, unknown>): GatewayLink {
  const payments = Array.isArray(j.payments) ? (j.payments as Array<Record<string, unknown>>) : [];
  const captured = payments.find((p) => p.status === "captured") ?? payments[0];
  const id = typeof j.id === "string" ? j.id : "";
  const url = typeof j.short_url === "string" ? j.short_url : "";
  if (!/^plink_[A-Za-z0-9]+$/.test(id) || !/^https?:\/\//.test(url)) throw new Error("Razorpay returned an unexpected payment link");
  return {
    id,
    url,
    status: typeof j.status === "string" ? j.status : "",
    amount: Number(j.amount) || 0,
    amountPaid: Number(j.amount_paid) || 0,
    referenceId: typeof j.reference_id === "string" ? j.reference_id : "",
    paymentId: captured && typeof captured.payment_id === "string" ? captured.payment_id : null,
  };
}

export function isGatewayLinkId(v: unknown): v is string {
  return typeof v === "string" && /^plink_[A-Za-z0-9]{6,40}$/.test(v);
}

export async function createGatewayLink(input: {
  amountRupees: number;
  referenceId: string;
  description: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string | null;
  callbackUrl: string;
}): Promise<GatewayLink> {
  return toLink(
    await call("POST", "/v1/payment_links", {
      amount: input.amountRupees * 100,
      currency: "INR",
      accept_partial: false,
      reference_id: input.referenceId,
      description: input.description.slice(0, 250),
      customer: { name: input.customerName, contact: input.customerMobile, ...(input.customerEmail ? { email: input.customerEmail } : {}) },
      // The buyer is already on the site; no extra SMS or email from Razorpay.
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: { order: input.referenceId },
      callback_url: input.callbackUrl,
      callback_method: "get",
    })
  );
}

export async function fetchGatewayLink(id: string): Promise<GatewayLink> {
  return toLink(await call("GET", `/v1/payment_links/${id}`));
}

/** Stops an unpaid link from being paid later. Best effort. */
export async function cancelGatewayLink(id: string): Promise<void> {
  try {
    await call("POST", `/v1/payment_links/${id}/cancel`);
  } catch {
    /* already paid, expired or cancelled */
  }
}

const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Razorpay needs a unique reference per link; a retry gets a short suffix. */
export function gatewayReference(orderNo: string, retry: boolean): string {
  if (!retry) return orderNo;
  let s = "";
  for (let i = 0; i < 4; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `${orderNo}-${s}`;
}

export const GATEWAY_VERIFIER = "Razorpay (automatic)";

type SyncOrder = { id: string; status: string; amount: number; gatewayLinkId: string | null; gatewayRef: string | null };

/**
 * Asks Razorpay whether this order's payment link has been paid and, if the
 * full amount was received against this order's own reference, marks the
 * order PAID. Returns the link (null when there is none or Razorpay could
 * not be reached) and whether the order is now paid.
 */
export async function syncGatewayPayment(db: PrismaClient, order: SyncOrder): Promise<{ paid: boolean; link: GatewayLink | null }> {
  if (order.status === "PAID") return { paid: true, link: null };
  if (!order.gatewayLinkId || !gatewayEnabled()) return { paid: false, link: null };
  let link: GatewayLink;
  try {
    link = await fetchGatewayLink(order.gatewayLinkId);
  } catch (err) {
    console.error("[store:gateway:sync]", err instanceof Error ? err.message : err);
    return { paid: false, link: null };
  }
  const expected = order.amount * 100;
  const settled = link.id === order.gatewayLinkId && link.status === "paid" && link.amount === expected && link.amountPaid >= expected && link.referenceId === order.gatewayRef;
  if (!settled) return { paid: false, link };
  // Guarded so two simultaneous checks cannot both write.
  await db.storeOrder.updateMany({
    where: { id: order.id, status: { not: "PAID" } },
    data: { status: "PAID", paidAt: new Date(), verifiedBy: GATEWAY_VERIFIER, ...(link.paymentId ? { paymentRef: link.paymentId } : {}) },
  });
  return { paid: true, link };
}
