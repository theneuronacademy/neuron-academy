"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle2, Send } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getNotifications } from "@/services/adminApi";
import type { AdminNotification } from "@/data/admin";

const DEFAULT_AUDIENCES = ["All students", "Faculty", "JEE 2027-A", "NEET 2027-A", "AMU-XI", "JMI-IX", "Foundation X", "Individual student"];

interface BatchListItem {
  name?: string;
}

interface NotificationApiItem {
  id?: string;
  title?: string;
  message?: string;
  status?: string;
  createdAt?: string;
  scheduledAt?: string;
}

function audienceEnumFor(label: string): string {
  if (label === "All students") return "ALL_STUDENTS";
  if (label === "Faculty") return "FACULTY";
  if (label === "Individual student") return "INDIVIDUAL";
  return "BATCH";
}

function toAdminNotification(item: NotificationApiItem, fallbackAudience: string, fallbackTitle: string, fallbackMessage: string, scheduled: boolean): AdminNotification {
  const status = item.status === "SENT" ? "Sent" : item.status === "SCHEDULED" || scheduled ? "Scheduled" : "Draft";
  const dateSource = typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString();
  return {
    id: typeof item.id === "string" ? item.id : `n-${Date.now()}`,
    title: typeof item.title === "string" ? item.title : fallbackTitle,
    message: typeof item.message === "string" ? item.message : fallbackMessage,
    audience: fallbackAudience,
    date: dateSource.slice(0, 10),
    status,
  };
}

export default function NotificationsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminNotification[]>([]);
  const [audiences, setAudiences] = useState<string[]>(DEFAULT_AUDIENCES);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState(DEFAULT_AUDIENCES[0]);
  const [schedule, setSchedule] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      // Real fetch: GET /api/batches for the audience list (fallback to defaults when DB is unavailable).
      try {
        const res = await fetch("/api/batches", { cache: "no-store" });
        const json = (await res.json()) as { success?: boolean; data?: { items?: BatchListItem[] } };
        if (json?.success && Array.isArray(json?.data?.items) && (json.data.items as BatchListItem[]).length > 0) {
          const names = (json.data.items as BatchListItem[]).map((b) => String(b.name ?? "").trim()).filter(Boolean);
          if (names.length > 0) {
            setAudiences(["All students", "Faculty", ...names, "Individual student"]);
          }
        }
      } catch {
        // Keep default audience list.
      }
      setRows(await getNotifications());
      setReady(true);
    })();
  }, [router]);

  const send = async (now: boolean) => {
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();
    if (!trimmedTitle || !trimmedMessage || busy) return;
    setBusy(true);
    const flash = (msg: string) => {
      setSaved(msg);
      window.setTimeout(() => setSaved(null), 3000);
    };
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          message: trimmedMessage,
          audience: audienceEnumFor(audience),
          ...(now ? { sendNow: true } : { sendNow: false, ...(schedule ? { scheduledAt: schedule } : {}) }),
        }),
      });
      const json = (await res.json()) as { success?: boolean; data?: { item?: NotificationApiItem } };
      const created = json?.data?.item;
      if (json?.success && created) {
        setRows((p) => [toAdminNotification(created, audience, trimmedTitle, trimmedMessage, !now), ...p]);
        setModal(false);
        setTitle("");
        setMessage("");
        flash(now ? "Notification sent." : "Notification scheduled.");
        return;
      }
      throw new Error("Send failed");
    } catch {
      setRows((p) => [{ id: `n-${Date.now()}`, title: trimmedTitle, message: trimmedMessage, audience, date: schedule || new Date().toISOString().slice(0, 10), status: now ? "Sent" : "Scheduled" }, ...p]);
      setModal(false);
      setTitle("");
      setMessage("");
      flash("Stored locally (database unavailable).");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <AdminLayout title="Notifications" subtitle="Communication → Notifications">
        <LoadingState message="Loading notifications…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Notifications" subtitle="Announce to batches, faculty or individuals">
      <AdminPageHeader title="Notifications" description="Push + in-app history. Delivery provider connects in backend phase." actionLabel="Create Notification" actionIcon={Plus} onAction={() => setModal(true)} />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No notifications yet" desc="Broadcast the first update to students or faculty." />
      ) : (
        <AdminTable<AdminNotification>
          columns={[
            { key: "t", header: "Title", render: (r) => <span><span className="block font-extrabold text-navy-700">{r.title}</span><span className="block max-w-md truncate text-[12px] text-muted">{r.message}</span></span> },
            { key: "a", header: "Audience", render: (r) => <span className="text-[13px] font-bold text-navy-700">{r.audience}</span> },
            { key: "d", header: "Date", render: (r) => <span className="text-muted">{r.date}</span> },
            { key: "s", header: "Status", render: (r) => <AdminStatusBadge tone={statusToneFor(r.status)}>{r.status}</AdminStatusBadge> },
          ]}
          rows={rows}
        />
      )}
      <AdminModal open={modal} title="Create Notification" onClose={() => setModal(false)}>
        <div className="grid gap-3">
          <label className="block text-[12px] font-bold text-navy-700">
            Audience
            <select value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Audience" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500">
              {audiences.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Title *
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mock on Sunday" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Message *
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="JEE Main Mock 14 starts 10 AM…" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Schedule (optional — leave empty for Send now)
            <input type="date" value={schedule} onChange={(e) => setSchedule(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => send(false)} disabled={busy}>
            Schedule
          </Button>
          <Button variant="primary" size="sm" onClick={() => send(true)} disabled={busy} aria-label="Send notification now">
            <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send now"}
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
