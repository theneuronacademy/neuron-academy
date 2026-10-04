"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CheckCircle2, Eye } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getPopups } from "@/services/adminApi";
import type { AdminPopup } from "@/data/admin";

const EMPTY: Omit<AdminPopup, "id"> = {
  title: "",
  message: "",
  image: "",
  videoUrl: "",
  buttonText: "",
  buttonUrl: "",
  frequency: "once-per-session",
  startDate: "",
  endDate: "",
  active: true,
};

function PopupPreview({ p }: { p: Partial<AdminPopup> }) {
  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-silver-300 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-silver-200 bg-silver-50 px-3 py-2">
        <p className="text-[11px] font-bold text-muted">PREVIEW • POPUP</p>
        <AdminStatusBadge tone={p.active ? "green" : "gray"}>{p.active ? "Active" : "Inactive"}</AdminStatusBadge>
      </div>
      <div className="p-4">
        <div className="overflow-hidden rounded-xl bg-navy-800">
          {p.videoUrl ? (
            <video src={p.videoUrl} controls className="h-44 w-full object-cover" />
          ) : p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt={p.title ?? "Popup"} className="h-44 w-full object-cover" />
          ) : (
            <div className="metallic-dark flex h-44 items-center justify-center p-4 text-center text-sm font-extrabold text-white">{p.title || "Popup title"}</div>
          )}
        </div>
        <p className="mt-3 text-[15px] font-extrabold text-navy-700">{p.title || "Popup title"}</p>
        <p className="mt-1 text-[13px] text-muted">{p.message || "Popup message appears here."}</p>
        <span className="mt-3 block rounded-xl bg-crimson-DEFAULT px-4 py-2 text-center text-[13px] font-bold text-white">{p.buttonText || "Button"}</span>
        <p className="mt-2 text-[11px] text-muted">
          {p.frequency} • {p.startDate || "start"} → {p.endDate || "end"}
        </p>
      </div>
    </div>
  );
}

export default function PopupsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminPopup[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<AdminPopup | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState<AdminPopup | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      // TODO backend: GET /api/admin/website/popups
      setRows(await getPopups());
      setReady(true);
    })();
  }, [router]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filter === "all" || (filter === "active" ? r.active : !r.active)) &&
          (!search.trim() || `${r.title} ${r.message}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [rows, search, filter]
  );

  const set = (k: keyof typeof EMPTY, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    if (!form.title.trim()) return;
    if (editing) setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, ...form } : r)));
    else setRows((p) => [...p, { ...form, id: `pp-${Date.now()}` }]);
    setModal(false);
    setSaved("Popup saved (demo).");
    window.setTimeout(() => setSaved(null), 2500);
  };

  if (!ready) {
    return (
      <AdminLayout title="Popups" subtitle="Website → Popups">
        <LoadingState message="Loading popups…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Popups" subtitle="Homepage offer popups with frequency control">
      <AdminPageHeader
        title="Popup Manager"
        description={`${filtered.length} popups • frequency controls how often visitors see them.`}
        actionLabel="Add Popup"
        actionIcon={Plus}
        onAction={() => {
          setEditing(null);
          setForm(EMPTY);
          setModal(true);
        }}
      />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search popups…" />
        <FilterBar value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No popups" desc="Create the first offer popup." action={<Button variant="primary" size="sm" onClick={() => { setEditing(null); setForm(EMPTY); setModal(true); }}>Add Popup</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-extrabold text-navy-700">{p.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{p.message}</p>
                  <p className="mt-1 text-[11px] font-bold text-muted">{p.frequency} • {p.startDate} → {p.endDate}</p>
                </div>
                <button onClick={() => setRows((rows) => rows.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)))}>
                  <AdminStatusBadge tone={p.active ? "green" : "gray"}>{p.active ? "Active" : "Inactive"}</AdminStatusBadge>
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button onClick={() => setPreview(p)} className="inline-flex items-center gap-1 rounded-lg border border-silver-300 px-2.5 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500">
                  <Eye className="h-3.5 w-3.5" /> Preview
                </button>
                <button
                  onClick={() => {
                    setEditing(p);
                    setForm({ title: p.title, message: p.message, image: p.image, videoUrl: p.videoUrl, buttonText: p.buttonText, buttonUrl: p.buttonUrl, frequency: p.frequency, startDate: p.startDate, endDate: p.endDate, active: p.active });
                    setModal(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-silver-300 px-2.5 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete popup "${p.title}"?`)) setRows((rows) => rows.filter((x) => x.id !== p.id));
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-crimson-100 px-2.5 py-1.5 text-[12px] font-bold text-crimson-DEFAULT hover:bg-crimson-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <AdminModal open={modal} title={editing ? "Edit Popup" : "Add Popup"} onClose={() => setModal(false)} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] font-bold text-navy-700">
            Title *
            <input value={form.title} onChange={(e) => set("title", e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="Book Your Free Demo" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Display frequency
            <select value={form.frequency} onChange={(e) => set("frequency", e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500">
              <option value="once-per-session">Once per session</option>
              <option value="once-per-day">Once per day</option>
              <option value="every-visit">Every visit</option>
            </select>
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Image URL
            <input value={form.image} onChange={(e) => set("image", e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="https://…" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Video URL
            <input value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="https://… (optional)" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Button text
            <input value={form.buttonText} onChange={(e) => set("buttonText", e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="Book Free Demo" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Button URL
            <input value={form.buttonUrl} onChange={(e) => set("buttonUrl", e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="#contact" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Start date
            <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            End date
            <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
          </label>
        </div>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Message
          <textarea value={form.message} onChange={(e) => set("message", e.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="Attend 2 demo classes + 1 mock test free…" />
        </label>
        <label className="mt-3 flex items-center gap-2 text-[13px] font-bold text-navy-700">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4 accent-teal-600" /> Active
        </label>
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold tracking-widest text-muted">LIVE PREVIEW</p>
          <PopupPreview p={form} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save}>
            Save Popup (demo)
          </Button>
        </div>
      </AdminModal>
      <AdminModal open={preview !== null} title="Popup Preview" onClose={() => setPreview(null)}>
        {preview ? <PopupPreview p={preview} /> : null}
      </AdminModal>
    </AdminLayout>
  );
}
