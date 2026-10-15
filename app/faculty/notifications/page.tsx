"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { FacultyShell } from "@/components/faculty/FacultyShell";

interface FeedItem { id: string; title: string; message: string; type: string; testId: string | null; isRead: boolean; createdAt: string }

export default function FacultyNotificationsPage() {
  const router = useRouter();
  const [feed, setFeed] = React.useState<FeedItem[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  // Batch messaging composer.
  const [batches, setBatches] = React.useState<{ id: string; name: string }[]>([]);
  const [batchId, setBatchId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sent, setSent] = React.useState<{ id: string; title: string; message: string; createdAt: string }[]>([]);
  const [sendState, setSendState] = React.useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/notifications/mine?limit=50", { cache: "no-store" });
    if (res.status === 401) { router.replace("/faculty/login"); return; }
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success === true && Array.isArray(json.data?.items)) setFeed(json.data.items as FeedItem[]);
    else setFeed([]);
  }

  async function loadComposer() {
    try {
      const [bR, sR] = await Promise.all([
        fetch("/api/faculty/batches", { cache: "no-store" }),
        fetch("/api/faculty/announcements", { cache: "no-store" }),
      ]);
      const bJ = await bR.json().catch(() => null);
      if (bR.ok && bJ?.success && Array.isArray(bJ.data?.items)) {
        const list = (bJ.data.items as { id: string; name: string }[]).map((b) => ({ id: b.id, name: b.name }));
        setBatches(list);
        if (list.length > 0) setBatchId((cur) => cur || list[0].id);
      }
      const sJ = await sR.json().catch(() => null);
      if (sR.ok && sJ?.success && Array.isArray(sJ.data?.items)) setSent(sJ.data.items);
    } catch {
      /* composer stays empty */
    }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      if (live) {
        await load();
        await loadComposer();
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function markOne(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/notifications/mine", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (res.ok) setFeed((f) => (f ? f.map((n) => (n.id === id ? { ...n, isRead: true } : n)) : f));
    } catch { /* ignore */ } finally { setBusy(null); }
  }

  async function markAll() {
    setBusy("all");
    try {
      const res = await fetch("/api/notifications/mine", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
      if (res.ok) setFeed((f) => (f ? f.map((n) => ({ ...n, isRead: true })) : f));
    } catch { /* ignore */ } finally { setBusy(null); }
  }

  if (feed === null) {
    return (
      <FacultyShell title="Notifications" subtitle="Faculty announcements and updates">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading notifications</p>
      </FacultyShell>
    );
  }

  const unread = feed.filter((n) => !n.isRead).length;

  async function sendAnnouncement() {
    if (!batchId) { setSendState("Select a batch first."); return; }
    if (title.trim().length < 3 || message.trim().length < 3) {
      setSendState("Title and message need at least 3 characters.");
      return;
    }
    setBusy("send");
    setSendState(null);
    try {
      const res = await fetch("/api/faculty/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, title: title.trim(), message: message.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setSendState(json?.error ?? "Could not send announcement.");
        return;
      }
      setTitle("");
      setMessage("");
      setSendState("Announcement sent to your batch.");
      await loadComposer();
    } catch {
      setSendState("Cannot reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <FacultyShell title="Notifications" subtitle={unread > 0 ? `${unread} unread` : "Send updates to your batches"}>
      <div className="mb-4 rounded-card border border-teal-200 bg-teal-50/50 p-4 shadow-card">
        <p className="text-[14px] font-extrabold text-navy-700">📣 Announce to a batch</p>
        {sendState ? <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[13px] font-bold text-navy-700" role="status">{sendState}</p> : null}
        <div className="mt-2 grid gap-2 sm:grid-cols-[200px_1fr]">
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-xl border border-silver-300 bg-white px-3 py-2.5 text-sm font-bold text-navy-700">
            {batches.length === 0 ? <option value="">No batches</option> : null}
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" maxLength={120} className="rounded-xl border border-silver-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </div>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message for your batch (students get it in their feed)…" rows={2} maxLength={1000} className="mt-2 w-full rounded-xl border border-silver-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        <button onClick={sendAnnouncement} disabled={busy === "send" || batches.length === 0} className="mt-2 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-50">
          {busy === "send" ? "Sending…" : "Send to Batch"}
        </button>
        {sent.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {sent.slice(0, 3).map((s) => (
              <li key={s.id} className="rounded-xl bg-white px-3 py-2 text-[12px] text-muted">
                <span className="font-extrabold text-navy-700">{s.title}</span> — {s.message.slice(0, 80)}{s.message.length > 80 ? "…" : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="mb-3 flex justify-end">
        {unread > 0 ? (
          <button onClick={() => void markAll()} disabled={busy === "all"} className="flex items-center gap-1.5 rounded-xl border border-silver-300 bg-white px-4 py-2 text-[13px] font-bold text-navy-700 hover:border-teal-500 disabled:opacity-60">
            {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Mark all as read
          </button>
        ) : null}
      </div>
      {feed.length === 0 ? (
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No notifications yet.</p>
      ) : (
        <ul className="grid gap-3">
          {feed.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <div>
                <p className="text-sm font-extrabold text-navy-700">{n.title} {!n.isRead ? <span className="ml-1 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span> : null}</p>
                <p className="mt-0.5 text-[13px] text-muted">{n.message}</p>
                <p className="mt-1 text-[11px] text-muted">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.isRead ? (
                <button onClick={() => void markOne(n.id)} disabled={busy === n.id} className="shrink-0 rounded-lg border border-silver-300 px-3 py-1.5 text-[12px] font-bold disabled:opacity-60">
                  {busy === n.id ? "..." : "Mark read"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </FacultyShell>
  );
}
