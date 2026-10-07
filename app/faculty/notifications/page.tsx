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

  async function load() {
    const res = await fetch("/api/notifications/mine", { cache: "no-store" });
    if (res.status === 401) { router.replace("/faculty/login"); return; }
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success === true && Array.isArray(json.data?.items)) setFeed(json.data.items as FeedItem[]);
    else setFeed([]);
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      if (live) await load();
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

  return (
    <FacultyShell title="Notifications" subtitle={unread > 0 ? `${unread} unread` : "Faculty announcements and updates"}>
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
