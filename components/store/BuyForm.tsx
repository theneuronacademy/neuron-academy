"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

const MEMORY_KEY = "neuron_store_orders";

/** Orders this browser has started, by item id → private order token. */
function readMemory(): Record<string, string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(MEMORY_KEY) ?? "{}");
    return raw && typeof raw === "object" ? (raw as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Buyer details → places the order → continues to the payment step. */
export function BuyForm({ bookId, priceLabel, instantPay = false }: { bookId: string; priceLabel: string; instantPay?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);

  useEffect(() => {
    const token = readMemory()[bookId];
    if (typeof token === "string" && /^[A-Za-z0-9_-]{32}$/.test(token)) setExisting(token);
  }, [bookId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, name, mobile, email }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true || typeof json.data?.token !== "string") {
        setError(json?.error ?? "Could not place the order. Please try again.");
        setBusy(false);
        return;
      }
      try {
        window.localStorage.setItem(MEMORY_KEY, JSON.stringify({ ...readMemory(), [bookId]: json.data.token }));
      } catch {
        /* the order link still works without this */
      }
      if (instantPay) {
        // Straight to the payment page; the buyer returns to the order page, paid.
        window.location.assign(`/api/store/orders/${json.data.token}/pay`);
        return;
      }
      router.push(`/store/order/${json.data.token}`);
      setBusy(false);
    } catch {
      setBusy(false);
      setError("Cannot reach the server. Check your connection and try again.");
    }
  }

  const inputCls = "mt-1.5 w-full rounded-xl border border-silver-300 bg-white px-3.5 py-3 text-base text-navy-950 outline-none focus:border-brand-primary";

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {existing ? (
        <p className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-3 text-sm text-navy-950">
          You already started an order for this item.{" "}
          <Link href={`/store/order/${existing}`} className="font-bold text-brand-primary underline underline-offset-4">Open my order</Link>
        </p>
      ) : null}
      <label className="block text-sm font-bold text-navy-950">
        Student or parent name
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} className={inputCls} />
      </label>
      <label className="block text-sm font-bold text-navy-950">
        Mobile number (WhatsApp)
        <input value={mobile} onChange={(e) => setMobile(e.target.value)} type="tel" inputMode="numeric" autoComplete="tel" required maxLength={16} placeholder="10-digit mobile number" className={inputCls} />
      </label>
      <label className="block text-sm font-bold text-navy-950">
        Email <span className="font-medium text-neutral-600">(optional)</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" maxLength={160} className={inputCls} />
      </label>
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3.5 text-base font-bold text-white transition hover:bg-brand-primary-hover disabled:opacity-60">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
        {instantPay ? "Pay" : "Continue to payment ·"} {priceLabel} {busy ? null : <ArrowRight className="h-5 w-5" aria-hidden />}
      </button>
      <p className="text-[13px] leading-relaxed text-neutral-600">
        {instantPay
          ? "You pay on Razorpay's secure page by UPI, card or net banking. Your download opens straight after payment."
          : "You pay on the next step. Your download unlocks after the academy confirms the payment."}{" "}
        Digital material is not refundable. <Link href="/refund-policy" className="font-bold text-brand-primary underline underline-offset-4">Refund policy</Link>
      </p>
    </form>
  );
}
