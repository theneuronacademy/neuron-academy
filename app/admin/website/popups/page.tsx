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
import { CloudinaryUpload } from "@/components/admin/CloudinaryUpload";
import { useAdminAuth } from "@/hooks/useAdminAuth";
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
            <div className="bg-metallic-dark flex h-44 items-center justify-center p-4 text-center text-sm font-extrabold text-white">{p.title || "Popup title"}</div>
          )}
        </div>
        <p className="mt-3 text-[15px] font-extrabold text-navy-700">{p.title || "Popup title"}</p>
        <p className="mt-1 text-[13px] text-muted">{p.message || "Popup message appears here."}</p>
        <span className="mt-3 block rounded-xl bg-crimson px-4 py-2 text-center text-[13px] font-bold text-white">{p.buttonText || "Button"}</span>
        <p className="mt-2 text-[11px] text-muted">
          {p.frequency} • {p.startDate || "start"} → {p.endDate || "end"}
        </p>
      </div>
    </div>
  );
}

export default function PopupsPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminPopup[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<AdminPopup | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState<AdminPopup | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // Phase 17 — persistence errors surface honestly (no local writes).
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/popups", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows((json.data.items as Array<{ id: string; title?: string; message?: string; imageUrl?: string; videoUrl?: string; buttonText?: string; buttonUrl?: string; frequency?: string; startDate?: string; endDate?: string; isActive?: boolean }>).map((p) => ({
            id: p.id,
            title: p.title ?? "",
            message: p.message ?? "",
            image: p.imageUrl ?? "",
            videoUrl: p.videoUrl ?? "",
            buttonText: p.buttonText ?? "",
            buttonUrl: p.buttonUrl ?? "",
            frequency: p.frequency === "ONCE_PER_DAY" ? "once-per-day" : p.frequency === "EVERY_VISIT" ? "every-visit" : "once-per-session",
            startDate: p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : "",
            endDate: p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : "",
            active: p.isActive ?? true,
          })));
        } else {
          setRows(await getPopups());
        }
      } catch {
        setRows(await getPopups());
      }
      setReady(true);
    })();
  }, [router, authReady, isAdmin]);

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
  const save = async () => {
    if (!form.title.trim()) return;
    // Phase 17 — popups persist via the API only (no local writes).
    setFormError(null);
    const payload = {
      title: form.title,
      message: form.message,
      imageUrl: form.image || undefined,
      videoUrl: form.videoUrl || undefined,
      buttonText: form.buttonText,
      buttonUrl: form.buttonUrl,
      frequency: form.frequency === "once-per-day" ? "ONCE_PER_DAY" : form.frequency === "every-visit" ? "EVERY_VISIT" : "ONCE_PER_SESSION",
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      isActive: form.active,
    };
    try {
      if (editing) {
        const res = await fetch(`/api/popups/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        if (res.ok) {
          setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, ...form } : r)));
          setSaved("Popup updated.");
          setModal(false);
        } else {
          const json = await res.json().catch(() => null);
          setFormError(json?.error ?? "Could not update popup. Nothing was saved.");
        }
      } else {
        const res = await fetch("/api/popups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.data?.item) {
          const item = json.data.item;
          setRows((p) => [...p, {
            id: item.id,
            title: item.title,
            message: item.message ?? "",
            image: item.imageUrl ?? "",
            videoUrl: item.videoUrl ?? "",
            buttonText: item.buttonText ?? "",
            buttonUrl: item.buttonUrl ?? "",
            frequency: form.frequency,
            startDate: item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : "",
            endDate: item.endDate ? new Date(item.endDate).toISOString().slice(0, 10) : "",
            active: item.isActive ?? true,
          }]);
          setSaved("Popup created.");
          setModal(false);
          setModal(false);
        } else {
          setFormError(json?.error ?? "Could not create popup. Nothing was saved.");
        }
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };
  const remove = async (p: AdminPopup) => {
    // Phase 17 — single confirmation lives here (callers must not pre-confirm).
    if (!window.confirm(`Delete popup "${p.title}"?`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/popups/${p.id}`, { method: "DELETE", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setRows((rows) => rows.filter((x) => x.id !== p.id));
        setSaved("Popup deleted.");
      } else {
        setPageError(json?.error ?? "Could not delete popup. Nothing was deleted.");
      }
    } catch {
      setPageError("Cannot reach the server. Nothing was deleted.");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };
  const toggleActive = async (p: AdminPopup) => {
    // Phase 17 — visibility flips persist immediately (controls the website).
    setPageError(null);
    const next = !p.active;
    try {
      const res = await fetch(`/api/popups/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success !== false) {
        setRows((rows) => rows.map((x) => (x.id === p.id ? { ...x, active: next } : x)));
      } else {
        setPageError(json?.error ?? "Could not change visibility.");
      }
    } catch {
      setPageError("Cannot reach the server. Visibility unchanged.");
    }
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
      {pageError ? (
        <p className="rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">
          {pageError}
        </p>
      ) : null}
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
                <button onClick={() => void toggleActive(p)} aria-label={`Toggle visibility of ${p.title}`} aria-pressed={p.active}>
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
                  onClick={() => void remove(p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-crimson-100 px-2.5 py-1.5 text-[12px] font-bold text-crimson hover:bg-crimson-50"
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
        <CloudinaryUpload
          category="banners"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          resourceType="image"
          label="Popup image"
          buttonLabel={form.image ? "Replace popup image" : "Upload popup image"}
          onUploadComplete={(url) => setForm((f) => ({ ...f, image: url }))}
        />
        <CloudinaryUpload
          category="banners"
          accept="video/mp4,video/mov,video/webm,video/avi,video/mkv"
          resourceType="video"
          label="Popup video"
          buttonLabel={form.videoUrl ? "Replace popup video" : "Upload popup video"}
          onUploadComplete={(url) => setForm((f) => ({ ...f, videoUrl: url }))}
        />
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
        {formError ? (
          <p className="rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson" role="alert">{formError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void save()}>
            Save Popup
          </Button>
        </div>
      </AdminModal>
      <AdminModal open={preview !== null} title="Popup Preview" onClose={() => setPreview(null)}>
        {preview ? <PopupPreview p={preview} /> : null}
      </AdminModal>
    </AdminLayout>
  );
}
