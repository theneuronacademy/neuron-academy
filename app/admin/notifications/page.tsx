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
import { getBatches, getNotifications } from "@/services/adminApi";
import type { AdminNotification } from "@/data/admin";

const AUDIENCES = ["All students", "Faculty", "JEE 2027-A", "NEET 2027-A", "AMU-XI", "JMI-IX", "Foundation X", "Individual student"];

export default function NotificationsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminNotification[]>([]);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [schedule, setSchedule] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      // TODO backend: GET /api/admin/notifications + GET /api/admin/batches (audience list)
      await getBatches();
      setRows(await getNotifications());
      setReady(true);
    })();
  }, [router]);

  const send = (now: boolean) => {
    if (!title.trim() || !message.trim()) return;
    setRows((p) => [{ id: `n-${Date.now()}`, title: title.trim(), message: message.trim(), audience, date: schedule || new Date().toISOString().slice(0, 10), status: now ? "Sent" : "Scheduled" }, ...p]);
    setModal(false);
    setTitle("");
    setMessage("");
    setSaved(now ? `Notification sent to ${audience} (demo).` : `Notification scheduled for ${schedule || "later"} (demo).`);
    window.setTimeout(() => setSaved(null), 3000);
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
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500">
              {AUDIENCES.map((a) => (
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
          <Button variant="outline" size="sm" onClick={() => send(false)}>
            Schedule (demo)
          </Button>
          <Button variant="primary" size="sm" onClick={() => send(true)}>
            <Send className="h-4 w-4" /> Send now (demo)
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
