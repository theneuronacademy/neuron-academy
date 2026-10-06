"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { getNotifications, markNotificationRead } from "@/lib/storage";

interface FeedItem {
  id: string;
  title: string;
  message: string;
  type: string;
  testId: string | null;
  isRead: boolean;
  createdAt: string;
}

/** Phase 13 — API in-app feed (read/unread, mark all) with local fallback. */
export default function StudentNotificationsPage() {
  const session = useStudentGuard();
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Phase 14 — category filter (hooks stay above every early return).
  const [cat, setCat] = useState("all");

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch("/api/notifications/mine", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success === true && Array.isArray(json.data?.items)) {
          setFeed(json.data.items as FeedItem[]);
          return;
        }
      } catch {
        /* fall through to local */
      }
      setFeed(null);
    })();
  }, [session]);

  async function markOne(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/notifications/mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setFeed((f) => (f ? f.map((n) => (n.id === id ? { ...n, isRead: true } : n)) : f));
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  async function markAll() {
    setBusy("all");
    try {
      const res = await fetch("/api/notifications/mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setFeed((f) => (f ? f.map((n) => ({ ...n, isRead: true })) : f));
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  // Local fallback (offline/demo): existing localStorage feed.
  if (feed === null) {
    const notifs = getNotifications().filter((n) => n.target === "students");
    return (
      <StudentShell title="Notifications" subtitle="Tests, results and announcements">
        {notifs.length === 0 ? (
          <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No notifications yet.</p>
        ) : (
          <ul className="grid gap-3">
            {notifs.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 rounded-card border border-silver-200 bg-white p-4 shadow-card">
                <div>
                  <p className="text-sm font-extrabold text-navy-700">{n.title} {!n.read ? <span className="ml-1 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span> : null}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{n.message}</p>
                  <p className="mt-1 text-[11px] text-muted">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  {n.testId ? <Link href={`/student/tests/${n.testId}`} className="rounded-lg bg-navy-700 px-3 py-1.5 text-center text-[12px] font-bold text-white">Open</Link> : null}
                  {!n.read ? <button onClick={() => { markNotificationRead(n.id); window.location.reload(); }} className="rounded-lg border border-silver-300 px-3 py-1.5 text-[12px] font-bold">Mark read</button> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </StudentShell>
    );
  }

  // Phase 14 — categories derived from the notification type (APIs unchanged).
  const categoryOf = (t: string) => {
    const x = t.toLowerCase();
    if (x.includes("result")) return "results";
    if (x.includes("access")) return "access";
    if (x.includes("attend")) return "attendance";
    if (x.includes("batch") || x.includes("announce")) return "batch";
    return "tests";
  };
  const cats = [
    { id: "all", label: "All" },
    { id: "tests", label: "Tests" },
    { id: "results", label: "Results" },
    { id: "attendance", label: "Attendance" },
    { id: "batch", label: "Batch" },
    { id: "access", label: "Access" },
  ];
  const visible = feed.filter((n) => cat === "all" || categoryOf(n.type) === cat);
  const unread = feed.filter((n) => !n.isRead).length;
  return (
    <StudentShell title="Notifications" subtitle={unread > 0 ? `${unread} unread` : "Tests, results and announcements"}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              aria-pressed={cat === c.id}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${cat === c.id ? "bg-navy-700 text-white" : "border border-silver-300 bg-white text-navy-700 hover:border-teal-500"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {unread > 0 ? (
          <button onClick={() => void markAll()} disabled={busy === "all"} className="flex items-center gap-1.5 rounded-xl border border-silver-300 bg-white px-4 py-2 text-[13px] font-bold text-navy-700 hover:border-teal-500 disabled:opacity-60">
            {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Mark all as read
          </button>
        ) : null}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">{feed.length === 0 ? "No notifications yet." : "Nothing in this category."}</p>
      ) : (
        <ul className="grid gap-3">
          {visible.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <div>
                <p className="text-sm font-extrabold text-navy-700">{n.title} {!n.isRead ? <span className="ml-1 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span> : null}</p>
                <p className="mt-0.5 text-[13px] text-muted">{n.message}</p>
                <p className="mt-1 text-[11px] text-muted">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                {n.testId ? <Link href={`/student/tests/${n.testId}`} className="rounded-lg bg-navy-700 px-3 py-1.5 text-center text-[12px] font-bold text-white">Open</Link> : null}
                {!n.isRead ? (
                  <button onClick={() => void markOne(n.id)} disabled={busy === n.id} className="rounded-lg border border-silver-300 px-3 py-1.5 text-[12px] font-bold disabled:opacity-60">
                    {busy === n.id ? "…" : "Mark read"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </StudentShell>
  );
}
