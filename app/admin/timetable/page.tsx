"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LoadingState } from "@/components/admin/AdminStates";
import { useAdminGuard } from "@/components/admin/useAdminGuard";

interface Batch { id: string; name: string }
interface Entry {
  id: string; batchId: string; subject: string; title: string | null;
  dayOfWeek: number; startTime: string; endTime: string; room: string | null;
  batch?: { name: string } | null; faculty?: { name: string } | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminTimetablePage() {
  const ready = useAdminGuard();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [items, setItems] = useState<Entry[]>([]);
  const [form, setForm] = useState({ subject: "", title: "", dayOfWeek: "1", startTime: "09:00", endTime: "10:00", room: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load(nextBatch = batchId) {
    try {
      const res = await fetch(`/api/timetable${nextBatch ? `?batchId=${encodeURIComponent(nextBatch)}` : ""}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      setItems(res.ok && json?.success === true && Array.isArray(json.data?.items) ? json.data.items : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const res = await fetch("/api/batches", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const list = res.ok && json?.success === true && Array.isArray(json.data?.items) ? json.data.items : [];
        setBatches(list.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })));
      } catch {
        /* ignore */
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function create() {
    if (!batchId) { setErr("Select a batch first."); return; }
    if (!form.subject.trim()) { setErr("Subject is required."); return; }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, subject: form.subject.trim(), title: form.title.trim() || undefined, dayOfWeek: Number(form.dayOfWeek), startTime: form.startTime, endTime: form.endTime, room: form.room.trim() || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Could not create entry.");
        return;
      }
      setMsg("Class added.");
      await load();
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this class?")) return;
    try {
      const res = await fetch(`/api/timetable/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMsg("Deleted.");
        await load();
      }
    } catch {
      setErr("Cannot reach the server.");
    }
  }

  const inputCls = "w-full rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500";
  const labelCls = "mb-1 block text-[11px] font-bold text-navy-700";

  if (!ready) {
    return (
      <AdminLayout title="Timetable" subtitle="Weekly class schedules per batch">
        <LoadingState message="Loading timetable…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Timetable" subtitle="Weekly class schedules per batch">
      <AdminPageHeader title="Timetable" description={`${items.length} scheduled classes • filter by batch, add or delete entries.`} />
      <div className="flex flex-wrap gap-2">
        <select value={batchId} onChange={(e) => { setBatchId(e.target.value); void load(e.target.value); }} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700">
          <option value="">All batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      {err ? <p className="mt-3 rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson-600" role="alert">{err}</p> : null}
      {msg ? <p className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-[13px] font-bold text-teal-700" role="status">{msg}</p> : null}

      <div className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
        <p className="text-[14px] font-extrabold text-navy-700">Add class{batches.find((b) => b.id === batchId)?.name ? ` — ${batches.find((b) => b.id === batchId)?.name}` : ""}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <label className={labelCls}>Subject *
            <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Physics" className={inputCls} />
          </label>
          <label className={labelCls}>Topic
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Rotational motion (optional)" className={inputCls} />
          </label>
          <label className={labelCls}>Day
            <select value={form.dayOfWeek} onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))} className={inputCls}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </label>
          <label className={labelCls}>Starts
            <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className={inputCls} />
          </label>
          <label className={labelCls}>Ends
            <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className={inputCls} />
          </label>
          <label className={labelCls}>Room
            <input value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} placeholder="A-2 (optional)" className={inputCls} />
          </label>
        </div>
        <div className="mt-2">
          <button onClick={create} disabled={busy} className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-50">{busy ? "Adding…" : "Add Class"}</button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-card border border-silver-200 bg-white shadow-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-silver-100 text-[11px] text-muted">
              <th className="p-3">Batch</th><th className="p-3">Day</th><th className="p-3">Time</th><th className="p-3">Subject</th><th className="p-3">Faculty</th><th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-silver-100 last:border-0">
                <td className="p-3 font-bold text-navy-700">{e.batch?.name ?? "—"}</td>
                <td className="p-3">{DAYS[e.dayOfWeek]}</td>
                <td className="p-3">{e.startTime}–{e.endTime}</td>
                <td className="p-3">{e.subject}{e.title ? ` · ${e.title}` : ""}</td>
                <td className="p-3">{e.faculty?.name ?? "—"}</td>
                <td className="p-3 text-right">
                  <button onClick={() => remove(e.id)} className="rounded-lg border border-silver-300 px-2.5 py-1.5 text-[11px] font-bold text-crimson-600 hover:border-crimson-500">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? <p className="p-6 text-center text-sm font-bold text-muted">No classes yet.</p> : null}
      </div>
    </AdminLayout>
  );
}
