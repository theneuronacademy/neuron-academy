"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Lets a buyer return to their order with the order number and mobile number. */
export function FindOrder() {
  const router = useRouter();
  const [orderNo, setOrderNo] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/store/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo, mobile }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true || typeof json.data?.token !== "string") {
        setError(json?.error ?? "Could not find that order.");
        return;
      }
      router.push(`/store/order/${json.data.token}`);
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "mt-1.5 w-full rounded-xl border border-silver-300 bg-white px-3.5 py-3 text-base text-navy-950 outline-none focus:border-brand-primary";

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
      <label className="block text-sm font-bold text-navy-950">
        Order number
        <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="NA-XXXXXX" maxLength={12} autoCapitalize="characters" className={inputCls} />
      </label>
      <label className="block text-sm font-bold text-navy-950">
        Mobile number used
        <input value={mobile} onChange={(e) => setMobile(e.target.value)} type="tel" inputMode="numeric" maxLength={16} className={inputCls} />
      </label>
      <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand-primary px-5 py-3 text-sm font-bold text-brand-primary transition hover:bg-brand-primary/5 disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Find my order
      </button>
      {error ? <p role="alert" className="text-sm font-bold text-red-700 sm:col-span-3">{error}</p> : null}
    </form>
  );
}
