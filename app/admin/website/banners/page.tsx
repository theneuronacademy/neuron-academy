"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CheckCircle2, Eye, ArrowUp, ArrowDown } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getBanners } from "@/services/adminApi";
import type { AdminBanner } from "@/data/admin";

const EMPTY: Omit<AdminBanner, "id"> = {
  title: "",
  subtitle: "",
  description: "",
  image: "",
  videoUrl: "",
  buttonText: "",
  buttonUrl: "",
  startDate: "",
  endDate: "",
  active: true,
  order: 1,
};

function BannerPreview({ b }: { b: Partial<AdminBanner> }) {
  const hasVideo = Boolean(b.videoUrl);
  return (
    <div className="overflow-hidden rounded-2xl border border-silver-300 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-silver-200 bg-silver-50 px-3 py-2">
        <p className="text-[11px] font-bold text-muted">PREVIEW • HOMEPAGE CAROUSEL</p>
        <AdminStatusBadge tone={b.active ? "green" : "gray"}>{b.active ? "Active" : "Inactive"}</AdminStatusBadge>
      </div>
      <div className="grid sm:grid-cols-2">
        <div className="relative flex h-48 items-center justify-center bg-navy-800 p-4 text-center">
          {hasVideo ? (
            <video src={b.videoUrl} controls className="absolute inset-0 h-full w-full object-cover" />
          ) : b.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.image} alt={b.title ?? "Banner"} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="metallic-dark absolute inset-0 flex items-center justify-center p-4 text-sm font-extrabold text-white">{b.title || "Banner title"}</span>
          )}
        </div>
        <div className="p-4">
          <p className="text-[11px] font-bold tracking-widest text-teal-600">{(b.subtitle || "Subtitle").toUpperCase()}</p>
          <p className="mt-1 text-lg font-extrabold text-navy-700">{b.title || "Banner title"}</p>
          <p className="mt-1 text-[13px] text-muted">{b.description || "Banner description appears here."}</p>
          <span className="mt-3 inline-block rounded-xl bg-navy-700 px-4 py-2 text-[13px] font-bold text-white">{b.buttonText || "Button"} →</span>
          <p className="mt-2 truncate text-[11px] text-muted">
            {b.buttonUrl || "Button URL"} • order {b.order ?? 1}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BannersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminBanner[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<AdminBanner | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState<AdminBanner | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      // TODO backend: GET /api/admin/website/banners
      setRows(await getBanners());
      setReady(true);
    })();
  }, [router]);

  const filtered = useMemo(
    () =>
      [...rows]
        .sort((a, b) => a.order - b.order)
        .filter(
          (r) =>
            (filter === "all" || (filter === "active" ? r.active : !r.active)) &&
            (!search.trim() || `${r.title} ${r.subtitle}`.toLowerCase().includes(search.toLowerCase()))
        ),
    [rows, search, filter]
  );

  const set = (k: keyof typeof EMPTY, v: string | boolean | number) => setForm((f) => ({ ...f, [k]: v }));
  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY, order: rows.length + 1 });
    setModal(true);
  };
  const openEdit = (r: AdminBanner) => {
    setEditing(r);
    setForm({ title: r.title, subtitle: r.subtitle, description: r.description, image: r.image, videoUrl: r.videoUrl, buttonText: r.buttonText, buttonUrl: r.buttonUrl, startDate: r.startDate, endDate: r.endDate, active: r.active, order: r.order });
    setModal(true);
  };
  const save = () => {
    if (!form.title.trim()) return;
    if (editing) setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, ...form } : r)));
    else setRows((p) => [...p, { ...form, id: `bn-${Date.now()}` }]);
    setModal(false);
    setSaved(editing ? "Banner updated — no code needed (demo)." : "Banner created — no code needed (demo).");
    window.setTimeout(() => setSaved(null), 3000);
  };
  const remove = (r: AdminBanner) => {
    if (!window.confirm(`Delete banner "${r.title}"?`)) return;
    setRows((p) => p.filter((x) => x.id !== r.id));
  };
  const move = (r: AdminBanner, dir: -1 | 1) => {
    setRows((p) => {
      const sorted = [...p].sort((a, b) => a.order - b.order);
      const i = sorted.findIndex((x) => x.id === r.id);
      const j = i + dir;
      if (j < 0 || j >= sorted.length) return p;
      const next = [...sorted];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((x, idx) => ({ ...x, order: idx + 1 }));
    });
  };

  if (!ready) {
    return (
      <AdminLayout title="Banners" subtitle="Website → Banners">
        <LoadingState message="Loading banners…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Banners" subtitle="Promotional carousel — create promos without touching code">
      <AdminPageHeader title="Banner Manager" description={`${filtered.length} banners • display order controls homepage carousel sequence.`} actionLabel="Add Banner" actionIcon={Plus} onAction={openAdd} />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search banners…" />
        <FilterBar value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No banners" desc="Create the first homepage promotion — title, image/video, button and schedule." action={<Button variant="primary" size="sm" onClick={openAdd}>Add Banner</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((b) => (
            <div key={b.id} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-muted">ORDER {b.order} • {b.startDate} → {b.endDate}</p>
                  <p className="mt-1 truncate text-[15px] font-extrabold text-navy-700">{b.title}</p>
                  <p className="truncate text-[12px] text-muted">{b.subtitle}</p>
                </div>
                <button onClick={() => setRows((p) => p.map((x) => (x.id === b.id ? { ...x, active: !x.active } : x)))}>
                  <AdminStatusBadge tone={b.active ? "green" : "gray"}>{b.active ? "Active" : "Inactive"}</AdminStatusBadge>
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button onClick={() => setPreview(b)} className="inline-flex items-center gap-1 rounded-lg border border-silver-300 px-2.5 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500">
                  <Eye className="h-3.5 w-3.5" /> Preview
                </button>
                <button onClick={() => openEdit(b)} className="inline-flex items-center gap-1 rounded-lg border border-silver-300 px-2.5 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => move(b, -1)} aria-label="Move up" className="rounded-lg border border-silver-300 p-1.5 text-navy-700 hover:border-teal-500">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => move(b, 1)} aria-label="Move down" className="rounded-lg border border-silver-300 p-1.5 text-navy-700 hover:border-teal-500">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => remove(b)} className="inline-flex items-center gap-1 rounded-lg border border-crimson-100 px-2.5 py-1.5 text-[12px] font-bold text-crimson-DEFAULT hover:bg-crimson-50">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminModal open={modal} title={editing ? "Edit Banner" : "Add Banner"} onClose={() => setModal(false)} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["title", "Title *", "Admissions Open 2026–27"],
              ["subtitle", "Subtitle", "JEE • NEET • AMU • Jamia"],
              ["buttonText", "Button text", "Explore Courses"],
              ["buttonUrl", "Button URL", "#courses"],
              ["image", "Image URL", "https://… / leave empty for gradient"],
              ["videoUrl", "Video URL", "https://… / optional"],
              ["startDate", "Start date", ""],
              ["endDate", "End date", ""],
            ] as const
          ).map(([k, label, ph]) => (
            <label key={k} className="block text-[12px] font-bold text-navy-700">
              {label}
              <input
                value={String(form[k] ?? "")}
                onChange={(e) => set(k, e.target.value)}
                placeholder={ph}
                type={k === "startDate" || k === "endDate" ? "date" : "text"}
                className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-teal-500"
              />
            </label>
          ))}
          <label className="block text-[12px] font-bold text-navy-700">
            Display order
            <input value={form.order} onChange={(e) => set("order", Number(e.target.value) || 1)} type="number" min={1} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
          </label>
          <label className="flex items-center gap-2 text-[13px] font-bold text-navy-700">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-teal-600" /> Active
          </label>
        </div>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Description
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Small batches, weekly mocks…" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-teal-500" />
        </label>
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold tracking-widest text-muted">LIVE PREVIEW</p>
          <BannerPreview b={form} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save}>
            Save Banner (demo)
          </Button>
        </div>
      </AdminModal>

      <AdminModal open={preview !== null} title="Banner Preview" onClose={() => setPreview(null)} wide>
        {preview ? <BannerPreview b={preview} /> : null}
      </AdminModal>
    </AdminLayout>
  );
}
