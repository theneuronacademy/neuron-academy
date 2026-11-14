"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CheckCircle2, Clock, Copy, IndianRupee, Loader2, MessageCircle, Plus, RotateCcw, Settings, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState, ErrorState } from "@/components/admin/AdminStates";
import { SearchBar } from "@/components/admin/SearchBar";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/primitives";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { cn } from "@/lib/utils";

type Status = "PENDING" | "SUBMITTED" | "PAID" | "CANCELLED";

interface Order {
  id: string; orderNo: string; accessToken: string; bookId: string; bookTitle: string; amount: number;
  buyerName: string; buyerMobile: string; buyerEmail: string | null; status: Status; paymentRef: string | null;
  paidAt: string | null; verifiedBy: string | null; adminNote: string | null; source: string;
  downloadCount: number; lastDownloadAt: string | null; createdAt: string;
}
interface PaidBook { id: string; title: string; price: number | null; isPaid: boolean; isActive: boolean; pdfUrl: string | null; externalUrl: string | null }
interface StoreSettings { upiId: string | null; payeeName: string | null; paymentLink: string | null; instructions: string | null }

const STATUS_LABEL: Record<Status, string> = { PENDING: "Not paid yet", SUBMITTED: "To verify", PAID: "Paid", CANCELLED: "Cancelled" };
const STATUS_TONE: Record<Status, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  SUBMITTED: "bg-blue-50 text-blue-800 ring-blue-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-silver-100 text-neutral-600 ring-silver-300",
};
const TABS: { key: Status | "ALL"; label: string }[] = [
  { key: "SUBMITTED", label: "To verify" },
  { key: "PENDING", label: "Not paid yet" },
  { key: "PAID", label: "Paid" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "ALL", label: "All" },
];

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");

/** Store orders: verify payments, unlock downloads, record offline sales, and set how buyers pay. */
export default function AdminStorePage() {
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<Status, number>>({ PENDING: 0, SUBMITTED: 0, PAID: 0, CANCELLED: 0 });
  const [revenue, setRevenue] = useState(0);
  const [books, setBooks] = useState<PaidBook[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ upiId: null, payeeName: null, paymentLink: null, instructions: null });
  const [tab, setTab] = useState<Status | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modals
  const [confirming, setConfirming] = useState<Order | null>(null);
  const [confirmRef, setConfirmRef] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<StoreSettings>(settings);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ bookId: "", buyerName: "", buyerMobile: "", buyerEmail: "", amount: "", paymentRef: "", markPaid: true, adminNote: "" });
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const load = useCallback(async (first = false) => {
    try {
      const [o, b, s] = await Promise.all([
        fetch("/api/admin/store/orders", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/books", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/store/settings", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (o?.success !== true) throw new Error("orders");
      setOrders(o.data.items as Order[]);
      setCounts(o.data.counts as Record<Status, number>);
      setRevenue(Number(o.data.revenue) || 0);
      if (b?.success === true) setBooks((b.data.items as PaidBook[]).filter((x) => x.isPaid));
      if (s?.success === true) setSettings(s.data.item as StoreSettings);
      if (first && (o.data.counts as Record<Status, number>).SUBMITTED > 0) setTab("SUBMITTED");
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    (async () => {
      await load(true);
      setReady(true);
    })();
  }, [authReady, isAdmin, load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (tab === "ALL" || o.status === tab) &&
        (!q || `${o.orderNo} ${o.buyerName} ${o.buyerMobile} ${o.bookTitle} ${o.paymentRef ?? ""}`.toLowerCase().includes(q))
    );
  }, [orders, tab, search]);

  async function act(order: Order, action: "markPaid" | "cancel" | "reopen", extra: Record<string, unknown> = {}): Promise<boolean> {
    setBusyId(order.id);
    try {
      const res = await fetch(`/api/admin/store/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setModalError(json?.error ?? "Could not update the order.");
        if (!confirming) flash(json?.error ?? "Could not update the order.");
        return false;
      }
      await load();
      return true;
    } catch {
      flash("Cannot reach the server.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const orderLink = (o: Order) => `${window.location.origin}/store/order/${o.accessToken}`;

  function whatsappHref(o: Order): string {
    const text =
      o.status === "PAID"
        ? `Hello ${o.buyerName}, your payment for "${o.bookTitle}" (order ${o.orderNo}) is confirmed. Download your PDF here: ${orderLink(o)}\n\n- Neuron Academy`
        : `Hello ${o.buyerName}, this is Neuron Academy about your order ${o.orderNo} for "${o.bookTitle}" (${rupees(o.amount)}). You can pay and get your download here: ${orderLink(o)}`;
    return `https://wa.me/${o.buyerMobile.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
  }

  async function saveSettings() {
    setModalBusy(true);
    setModalError(null);
    try {
      const res = await fetch("/api/admin/store/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settingsForm) });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setModalError(json?.error ?? "Could not save.");
        return;
      }
      setSettings(json.data.item as StoreSettings);
      setSettingsOpen(false);
      flash("Payment settings saved.");
    } catch {
      setModalError("Cannot reach the server.");
    } finally {
      setModalBusy(false);
    }
  }

  async function createOrder() {
    setModalBusy(true);
    setModalError(null);
    try {
      const res = await fetch("/api/admin/store/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newForm) });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setModalError(json?.error ?? "Could not add the order.");
        return;
      }
      setNewOpen(false);
      await load();
      setTab("ALL");
      flash(`Order ${json.data.item.orderNo} added.`);
    } catch {
      setModalError("Cannot reach the server.");
    } finally {
      setModalBusy(false);
    }
  }

  if (!ready) {
    return (
      <AdminLayout title="Store Orders" subtitle="Books & Study Material → Store Orders">
        <LoadingState message="Loading orders…" />
      </AdminLayout>
    );
  }

  const inputCls = "mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm";
  const canTakePayments = Boolean(settings.upiId || settings.paymentLink) || books.some((b) => b.isActive);
  const hasPayMethod = Boolean(settings.upiId || settings.paymentLink);
  const btn = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-bold transition disabled:opacity-50";

  return (
    <AdminLayout title="Store Orders" subtitle={`${orders.length} order${orders.length === 1 ? "" : "s"} • ${counts.SUBMITTED} waiting for you to verify`}>
      <AdminPageHeader
        title="Store Orders"
        description="Buyers pay you directly. Check that the money has arrived, then mark the order paid to unlock their download."
        actionLabel="Add order"
        actionIcon={Plus}
        onAction={() => {
          setNewForm({ bookId: books[0]?.id ?? "", buyerName: "", buyerMobile: "", buyerEmail: "", amount: "", paymentRef: "", markPaid: true, adminNote: "" });
          setModalError(null);
          setNewOpen(true);
        }}
        secondaryLabel="Payment settings"
        onSecondary={() => {
          setSettingsForm(settings);
          setModalError(null);
          setSettingsOpen(true);
        }}
      />

      {notice ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700" role="status">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </p>
      ) : null}

      {/* Setup reminders */}
      {!hasPayMethod ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-900">
          <Settings className="h-4 w-4 shrink-0" />
          <span className="flex-1">Add your UPI ID or a payment link so buyers know how to pay you. Until then, items without their own payment link cannot be ordered online.</span>
          <button onClick={() => { setSettingsForm(settings); setModalError(null); setSettingsOpen(true); }} className="rounded-lg bg-amber-900 px-3 py-2 text-[12px] font-bold text-white">Open payment settings</button>
        </div>
      ) : null}
      {books.length === 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-silver-200 bg-white px-4 py-3 text-[13px] font-bold text-navy-700">
          <span className="flex-1">Nothing is set up for sale yet. Open a book, tick “Sell this item” and give it a price.</span>
          <Link href="/admin/books" className="rounded-lg border border-silver-300 px-3 py-2 text-[12px] font-bold text-navy-700 hover:border-teal-500">Go to Books</Link>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="To verify" value={counts.SUBMITTED} sub="Buyer says they have paid" icon={Clock} accent={counts.SUBMITTED > 0 ? "crimson" : "navy"} />
        <StatCard label="Not paid yet" value={counts.PENDING} sub="Order placed, no payment reported" icon={Clock} accent="navy" />
        <StatCard label="Paid orders" value={counts.PAID} sub="Download unlocked" icon={BadgeCheck} />
        <StatCard label="Total received" value={rupees(revenue)} sub="Sum of paid orders" icon={IndianRupee} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter orders">
        {TABS.map((t) => {
          const n = t.key === "ALL" ? orders.length : counts[t.key];
          return (
            <button key={t.key} onClick={() => setTab(t.key)} aria-pressed={tab === t.key} className={cn("rounded-full px-4 py-2 text-[13px] font-bold transition", tab === t.key ? "bg-navy-700 text-white" : "border border-silver-300 bg-white text-navy-700 hover:border-teal-500")}>
              {t.label} <span className="opacity-70">({n})</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search order number, name, mobile, reference…" />
      </div>

      {loadError ? (
        <div className="mt-4"><ErrorState message="Could not load orders." onRetry={() => void load()} /></div>
      ) : shown.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={orders.length === 0 ? "No orders yet" : "No orders here"} desc={orders.length === 0 ? (canTakePayments ? "Orders appear here as soon as someone buys from the store." : "Set up an item for sale to start receiving orders.") : "Try another filter or search."} />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((o) => (
            <li key={o.id} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-[15px] font-extrabold text-navy-700">{o.orderNo}</span>
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1", STATUS_TONE[o.status])}>{STATUS_LABEL[o.status]}</span>
                {o.source === "ADMIN" ? <span className="rounded-full bg-silver-100 px-2.5 py-1 text-[11px] font-bold text-neutral-600">Added by admin</span> : null}
                <span className="ml-auto text-[12px] font-semibold text-muted">{when(o.createdAt)}</span>
              </div>
              <div className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                <p><span className="block text-[11px] font-bold tracking-wider text-muted">BUYER</span><span className="font-bold text-navy-700">{o.buyerName}</span><br /><a href={`tel:${o.buyerMobile}`} className="text-teal-700 underline-offset-2 hover:underline">{o.buyerMobile}</a>{o.buyerEmail ? <><br /><span className="break-all text-muted">{o.buyerEmail}</span></> : null}</p>
                <p><span className="block text-[11px] font-bold tracking-wider text-muted">ITEM</span><span className="font-bold text-navy-700">{o.bookTitle}</span></p>
                <p><span className="block text-[11px] font-bold tracking-wider text-muted">AMOUNT</span><span className="text-[15px] font-extrabold text-navy-700">{rupees(o.amount)}</span></p>
                <p><span className="block text-[11px] font-bold tracking-wider text-muted">PAYMENT REFERENCE</span><span className="break-all font-mono font-bold text-navy-700">{o.paymentRef ?? "—"}</span>
                  {o.status === "PAID" ? <><br /><span className="text-muted">Verified {when(o.paidAt)}{o.verifiedBy ? ` by ${o.verifiedBy}` : ""}</span><br /><span className="text-muted">{o.downloadCount} download{o.downloadCount === 1 ? "" : "s"}</span></> : null}</p>
              </div>
              {o.adminNote ? <p className="mt-2 rounded-lg bg-silver-50 px-3 py-2 text-[12px] text-navy-700"><span className="font-bold">Note:</span> {o.adminNote}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-silver-100 pt-3">
                {o.status === "PENDING" || o.status === "SUBMITTED" ? (
                  <button disabled={busyId === o.id} onClick={() => { setConfirming(o); setConfirmRef(o.paymentRef ?? ""); setModalError(null); }} className={cn(btn, "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700")}>
                    <BadgeCheck className="h-4 w-4" /> Mark paid
                  </button>
                ) : null}
                {o.status !== "CANCELLED" ? (
                  <button disabled={busyId === o.id} onClick={() => { if (window.confirm(o.status === "PAID" ? `Cancel order ${o.orderNo}? The buyer will lose access to the download.` : `Cancel order ${o.orderNo}?`)) void act(o, "cancel").then((ok) => ok && flash(`Order ${o.orderNo} cancelled.`)); }} className={cn(btn, "border-crimson-100 text-crimson hover:bg-crimson-50")}>
                    <XCircle className="h-4 w-4" /> Cancel
                  </button>
                ) : null}
                {o.status === "PAID" || o.status === "CANCELLED" ? (
                  <button disabled={busyId === o.id} onClick={() => { if (window.confirm(`Move order ${o.orderNo} back to waiting?${o.status === "PAID" ? " The download will be locked again." : ""}`)) void act(o, "reopen").then((ok) => ok && flash(`Order ${o.orderNo} reopened.`)); }} className={cn(btn, "border-silver-300 text-navy-700 hover:border-teal-500")}>
                    <RotateCcw className="h-4 w-4" /> Reopen
                  </button>
                ) : null}
                <a href={whatsappHref(o)} target="_blank" rel="noreferrer" className={cn(btn, "ml-auto border-[#25D366] text-[#128C4B] hover:bg-emerald-50")}>
                  <MessageCircle className="h-4 w-4" /> {o.status === "PAID" ? "Send download on WhatsApp" : "WhatsApp buyer"}
                </a>
                <button onClick={async () => { try { await navigator.clipboard.writeText(orderLink(o)); flash("Order link copied."); } catch { flash("Could not copy."); } }} className={cn(btn, "border-silver-300 text-navy-700 hover:border-teal-500")}>
                  <Copy className="h-4 w-4" /> Copy buyer link
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Confirm payment */}
      <AdminModal open={confirming !== null} title={confirming ? `Mark ${confirming.orderNo} as paid` : ""} onClose={() => setConfirming(null)}>
        {confirming ? (
          <>
            {modalError ? <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{modalError}</p> : null}
            <p className="text-[14px] leading-relaxed text-navy-700">
              Confirm only after you have seen <span className="font-extrabold">{rupees(confirming.amount)}</span> from <span className="font-extrabold">{confirming.buyerName}</span> in your bank or UPI app. This unlocks the download of “{confirming.bookTitle}”.
            </p>
            <label className="mt-4 block text-[12px] font-bold text-navy-700">Payment reference (transaction / UTR number)
              <input value={confirmRef} onChange={(e) => setConfirmRef(e.target.value)} placeholder="Optional" className={inputCls} />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirming(null)}>Not yet</Button>
              <Button variant="primary" size="sm" disabled={busyId === confirming.id} onClick={async () => {
                setModalError(null);
                const o = confirming;
                const ok = await act(o, "markPaid", confirmRef.trim() ? { paymentRef: confirmRef } : {});
                if (ok) { setConfirming(null); flash(`Order ${o.orderNo} marked paid. Send the buyer their link.`); }
              }}>
                {busyId === confirming.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Yes, payment received
              </Button>
            </div>
          </>
        ) : null}
      </AdminModal>

      {/* Payment settings */}
      <AdminModal open={settingsOpen} title="Payment settings" onClose={() => setSettingsOpen(false)}>
        {modalError ? <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{modalError}</p> : null}
        <p className="text-[13px] leading-relaxed text-muted">Buyers see these on the payment step. Fill in at least one way to pay. Money goes straight to your account; the website does not handle it.</p>
        <div className="mt-3 grid gap-3">
          <label className="block text-[12px] font-bold text-navy-700">UPI ID
            <input value={settingsForm.upiId ?? ""} onChange={(e) => { setModalError(null); setSettingsForm((f) => ({ ...f, upiId: e.target.value })); }} placeholder="e.g. neuronacademy@okhdfcbank" className={inputCls} />
            <span className="mt-1 block text-[12px] font-medium text-muted">Shown as a QR code with the amount and order number filled in.</span>
          </label>
          <label className="block text-[12px] font-bold text-navy-700">Name shown to the payer
            <input value={settingsForm.payeeName ?? ""} onChange={(e) => setSettingsForm((f) => ({ ...f, payeeName: e.target.value }))} placeholder="The name on your UPI / bank account" className={inputCls} />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">Payment link (optional)
            <input value={settingsForm.paymentLink ?? ""} onChange={(e) => setSettingsForm((f) => ({ ...f, paymentLink: e.target.value }))} placeholder="https://…" className={inputCls} />
            <span className="mt-1 block text-[12px] font-medium text-muted">Used for items that have no payment link of their own.</span>
          </label>
          <label className="block text-[12px] font-bold text-navy-700">Note to buyers (optional)
            <textarea value={settingsForm.instructions ?? ""} onChange={(e) => setSettingsForm((f) => ({ ...f, instructions: e.target.value }))} rows={3} placeholder="e.g. Payments are checked between 9 AM and 9 PM." className={inputCls} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={modalBusy} onClick={() => void saveSettings()}>{modalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save</Button>
        </div>
      </AdminModal>

      {/* Add order */}
      <AdminModal open={newOpen} title="Add an order" onClose={() => setNewOpen(false)}>
        {modalError ? <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{modalError}</p> : null}
        <p className="text-[13px] leading-relaxed text-muted">For a sale made outside the website, for example paid in person or on WhatsApp. You get a download link to send to the buyer.</p>
        {books.length === 0 ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-900">Set up an item for sale in Books first.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            <label className="block text-[12px] font-bold text-navy-700">Item *
              <select value={newForm.bookId} onChange={(e) => setNewForm((f) => ({ ...f, bookId: e.target.value }))} className={inputCls}>
                {books.map((b) => <option key={b.id} value={b.id}>{b.title}{b.price ? ` — ${rupees(b.price)}` : ""}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] font-bold text-navy-700">Buyer name *
                <input value={newForm.buyerName} onChange={(e) => setNewForm((f) => ({ ...f, buyerName: e.target.value }))} className={inputCls} />
              </label>
              <label className="block text-[12px] font-bold text-navy-700">Mobile *
                <input value={newForm.buyerMobile} onChange={(e) => setNewForm((f) => ({ ...f, buyerMobile: e.target.value }))} inputMode="numeric" placeholder="10-digit number" className={inputCls} />
              </label>
              <label className="block text-[12px] font-bold text-navy-700">Amount received (₹)
                <input value={newForm.amount} onChange={(e) => setNewForm((f) => ({ ...f, amount: e.target.value }))} inputMode="numeric" placeholder="Leave empty for list price" className={inputCls} />
              </label>
              <label className="block text-[12px] font-bold text-navy-700">Payment reference
                <input value={newForm.paymentRef} onChange={(e) => setNewForm((f) => ({ ...f, paymentRef: e.target.value }))} placeholder="Optional" className={inputCls} />
              </label>
            </div>
            <label className="block text-[12px] font-bold text-navy-700">Email (optional)
              <input value={newForm.buyerEmail} onChange={(e) => setNewForm((f) => ({ ...f, buyerEmail: e.target.value }))} type="email" className={inputCls} />
            </label>
            <label className="block text-[12px] font-bold text-navy-700">Note (only you see this)
              <input value={newForm.adminNote} onChange={(e) => setNewForm((f) => ({ ...f, adminNote: e.target.value }))} className={inputCls} />
            </label>
            <label className="flex items-center gap-2 text-[13px] font-bold text-navy-700">
              <input type="checkbox" checked={newForm.markPaid} onChange={(e) => setNewForm((f) => ({ ...f, markPaid: e.target.checked }))} className="h-4 w-4 accent-[#008C9E]" />
              Payment already received (unlock the download now)
            </label>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewOpen(false)}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={modalBusy || books.length === 0} onClick={() => void createOrder()}>{modalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add order</Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
