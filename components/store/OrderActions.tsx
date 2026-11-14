"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";

/** Copies text and briefly confirms it. */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          /* clipboard unavailable — the text is visible on the page */
        }
      }}
      className={className ?? "inline-flex items-center gap-1.5 rounded-lg border border-silver-300 bg-white px-3 py-1.5 text-[13px] font-bold text-navy-950 transition hover:border-brand-primary/40"}
    >
      {done ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {done ? "Copied" : label}
    </button>
  );
}

/** Copies this page's own address — the buyer's way back to the order. */
export function CopyPageLink() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href.split("?")[0]);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-silver-300 bg-white px-3 py-1.5 text-[13px] font-bold text-navy-950 transition hover:border-brand-primary/40"
    >
      {done ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {done ? "Link copied" : "Copy this page's link"}
    </button>
  );
}

/** Re-reads the order from the server (no automatic polling). */
export function RefreshStatus() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setBusy(true);
        router.refresh();
        window.setTimeout(() => setBusy(false), 1200);
      }}
      className="inline-flex items-center gap-2 rounded-xl border-2 border-brand-primary px-4 py-2.5 text-sm font-bold text-brand-primary transition hover:bg-brand-primary/5"
    >
      <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden /> Check status
    </button>
  );
}

/** The buyer reports the transaction reference after paying. */
export function PaymentReferenceForm({ token, current }: { token: string; current?: string | null }) {
  const router = useRouter();
  const [ref, setRef] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/store/orders/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentRef: ref }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setError(json?.error ?? "Could not save the reference. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="block text-sm font-bold text-navy-950">
        Transaction / UTR number
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="e.g. 431256789012"
          maxLength={44}
          autoCapitalize="characters"
          className="mt-1.5 w-full rounded-xl border border-silver-300 bg-white px-3.5 py-3 text-base text-navy-950 outline-none focus:border-brand-primary"
        />
      </label>
      <p className="mt-1.5 text-[13px] text-neutral-600">You will find it in your payment app under the transaction details.</p>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      <button type="submit" disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3.5 text-base font-bold text-white transition hover:bg-brand-primary-hover disabled:opacity-60 sm:w-auto">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null} {current ? "Update reference" : "I have paid"}
      </button>
    </form>
  );
}
