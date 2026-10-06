"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getAnnouncements } from "@/services/adminApi";

interface Row {
  id: string;
  text: string;
  date: string;
  active: boolean;
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [modal, setModal] = useState(false);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/announcements", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows(json.data.items.map((a: any) => ({
            id: a.id,
            text: a.title ?? a.text ?? "",
            date: a.startDate ? new Date(a.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            active: a.isActive ?? true,
          })));
        } else {
          const data = await getAnnouncements();
          setRows(data.map((a) => ({ id: a.id, text: a.text, date: a.date, active: a.active })));
        }
      } catch {
        const data = await getAnnouncements();
        setRows(data.map((a) => ({ id: a.id, text: a.text, date: a.date, active: a.active })));
      }
      setReady(true);
    })();
  }, [router]);

  const save = async () => {
    if (!text.trim()) return;
    const payload = { title: text.trim(), content: text.trim(), isActive: true };
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data?.item) {
        const item = json.data.item;
        setRows((p) => [{ id: item.id, text: item.title ?? item.text ?? text.trim(), date: item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10), active: item.isActive ?? true }, ...p]);
        setSaved("Announcement published.");
      } else {
        setRows((p) => [{ id: `an-${Date.now()}`, text: text.trim(), date: new Date().toISOString().slice(0, 10), active: true }, ...p]);
        setSaved("Announcement published locally (database unavailable).");
      }
    } catch {
      setRows((p) => [{ id: `an-${Date.now()}`, text: text.trim(), date: new Date().toISOString().slice(0, 10), active: true }, ...p]);
      setSaved("Saved locally (database unavailable).");
    }
    setModal(false);
    setText("");
    window.setTimeout(() => setSaved(null), 2500);
  };

  const remove = async (r: Row) => {
    if (!window.confirm(`Delete announcement "${r.text}"?`)) return;
    try {
      const res = await fetch(`/api/announcements/${r.id}`, { method: "DELETE", cache: "no-store" });
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Announcement deleted.");
      } else {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Deleted locally (database unavailable).");
      }
    } catch {
      setRows((p) => p.filter((x) => x.id !== r.id));
      setSaved("Deleted locally (database unavailable).");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };

  if (!ready) {
    return (
      <AdminLayout title="Announcements" subtitle="Website → Announcements">
        <LoadingState message="Loading announcements…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Announcements" subtitle="Top running ticker on the homepage">
      <AdminPageHeader title="Announcements" description="Ticker messages rotate above the navbar." actionLabel="Publish Announcement" actionIcon={Plus} onAction={() => { setText(""); setModal(true); }} />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No announcements" desc="Publish the first ticker message." />
      ) : (
        <AdminTable<Row>
          columns={[
            { key: "t", header: "Message", render: (r) => <span className="font-bold text-navy-700">{r.text}</span> },
            { key: "d", header: "Date", render: (r) => <span className="text-muted">{r.date}</span> },
            {
              key: "s",
              header: "Status",
              render: (r) => (
                <button onClick={() => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)))}>
                  <AdminStatusBadge tone={r.active ? "green" : "gray"}>{r.active ? "Live" : "Paused"}</AdminStatusBadge>
                </button>
              ),
            },
            {
              key: "x",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <button
                  onClick={() => remove(r)}
                  aria-label="Delete announcement"
                  className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ),
            },
          ]}
          rows={rows}
        />
      )}
      <AdminModal open={modal} title="Publish Announcement" onClose={() => setModal(false)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Ticker message
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Scholarship Test on Oct 12 — Register Free" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save}>
            Publish
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}