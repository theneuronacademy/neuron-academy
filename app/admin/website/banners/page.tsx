"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CheckCircle2, Eye, ArrowUp, ArrowDown, Sparkles, TriangleAlert } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { CloudinaryUpload } from "@/components/admin/CloudinaryUpload";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { getBanners } from "@/services/adminApi";
import { BANNER_ANIMATIONS, bannerAnimationClass, toBannerAnimation } from "@/components/website/bannerMotion";
import type { AdminBanner } from "@/data/admin";

const EMPTY: Omit<AdminBanner, "id"> = {
  title: "",
  subtitle: "",
  description: "",
  image: "",
  videoUrl: "",
  buttonText: "",
  buttonUrl: "",
  animation: "none",
  startDate: "",
  endDate: "",
  active: true,
  order: 1,
};

function BannerPreview({ b }: { b: Partial<AdminBanner> }) {
  const hasVideo = Boolean(b.videoUrl);
  const animationClass = b.animation && b.animation !== "none" ? bannerAnimationClass(b.animation) : "";
  return (
    <div className={`overflow-hidden rounded-2xl border border-silver-300 bg-white shadow-card ${animationClass}`}>
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
            <span className="bg-metallic-dark absolute inset-0 flex items-center justify-center p-4 text-sm font-extrabold text-white">{b.title || "Banner title"}</span>
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
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminBanner[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<AdminBanner | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState<AdminBanner | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // Phase 17 — persistence errors surface honestly (no local writes).
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/banners", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows((json.data.items as Array<{ id: string; title?: string; subtitle?: string; description?: string; imageUrl?: string; videoUrl?: string; buttonText?: string; buttonUrl?: string; animation?: string; startDate?: string; endDate?: string; isActive?: boolean; displayOrder?: number }>).map((b) => ({
            id: b.id,
            title: b.title ?? "",
            subtitle: b.subtitle ?? "",
            description: b.description ?? "",
            image: b.imageUrl ?? "",
            videoUrl: b.videoUrl ?? "",
            buttonText: b.buttonText ?? "",
            buttonUrl: b.buttonUrl ?? "",
            animation: toBannerAnimation(b.animation),
            startDate: b.startDate ? new Date(b.startDate).toISOString().slice(0, 10) : "",
            endDate: b.endDate ? new Date(b.endDate).toISOString().slice(0, 10) : "",
            active: b.isActive ?? true,
            order: b.displayOrder ?? 0,
          })));
        } else {
          setRows(await getBanners());
        }
      } catch {
        setRows(await getBanners());
      }
      setReady(true);
    })();
  }, [router, authReady, isAdmin]);

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
    setForm({ title: r.title, subtitle: r.subtitle, description: r.description, image: r.image, videoUrl: r.videoUrl, buttonText: r.buttonText, buttonUrl: r.buttonUrl, animation: toBannerAnimation(r.animation), startDate: r.startDate, endDate: r.endDate, active: r.active, order: r.order });
    setModal(true);
  };
  const save = async () => {
    if (!form.title.trim()) return;
    // Phase 17 — banners persist via the API only. Failures stay in the
    // modal as errors; nothing is written locally.
    setFormError(null);
    const payload = {
      title: form.title,
      subtitle: form.subtitle,
      description: form.description,
      imageUrl: form.image,
      videoUrl: form.videoUrl,
      buttonText: form.buttonText,
      buttonUrl: form.buttonUrl,
      animation: toBannerAnimation(form.animation),
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      isActive: form.active,
      displayOrder: form.order,
    };
    try {
      if (editing) {
        const res = await fetch(`/api/banners/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) {
          setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, ...form, animation: toBannerAnimation(form.animation) } : r)));
          setSaved(typeof json.warning === "string" && json.warning ? json.warning : "Banner updated — no code needed.");
          setModal(false);
        } else {
          setFormError(json?.error ?? "Could not update banner. Nothing was saved.");
        }
      } else {
        const res = await fetch("/api/banners", {
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
            subtitle: item.subtitle ?? "",
            description: item.description ?? "",
            image: item.imageUrl ?? "",
            videoUrl: item.videoUrl ?? "",
            buttonText: item.buttonText ?? "",
            buttonUrl: item.buttonUrl ?? "",
            animation: toBannerAnimation(item.animation),
            startDate: item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : "",
            endDate: item.endDate ? new Date(item.endDate).toISOString().slice(0, 10) : "",
            active: item.isActive ?? true,
            order: item.displayOrder ?? 0,
          }]);
          setSaved(typeof json.warning === "string" && json.warning ? json.warning : "Banner created — no code needed.");
          setModal(false);
        } else {
          setFormError(json?.error ?? "Could not create banner. Nothing was saved.");
        }
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
    }
    window.setTimeout(() => setSaved(null), 3000);
  };
  const remove = async (r: AdminBanner) => {
    if (!window.confirm(`Delete banner "${r.title}"?`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/banners/${r.id}`, { method: "DELETE", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Banner deleted.");
      } else {
        setPageError(json?.error ?? "Could not delete banner. Nothing was deleted.");
      }
    } catch {
      setPageError("Cannot reach the server. Nothing was deleted.");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };
  const toggleActive = async (r: AdminBanner) => {
    // Phase 17 — visibility flips persist immediately (controls the website).
    setPageError(null);
    const next = !r.active;
    try {
      const res = await fetch(`/api/banners/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success !== false) {
        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
      } else {
        setPageError(json?.error ?? "Could not change visibility.");
      }
    } catch {
      setPageError("Cannot reach the server. Visibility unchanged.");
    }
  };
  const move = async (r: AdminBanner, dir: -1 | 1) => {
    // Phase 17 — ordering persists via displayOrder PATCHes.
    const sorted = [...rows].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex((x) => x.id === r.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[i], next[j]] = [next[j], next[i]];
    const ordered = next.map((x, idx) => ({ ...x, order: idx + 1 }));
    setPageError(null);
    try {
      const results = await Promise.all(
        [ordered[i], ordered[j]].map((x) =>
          fetch(`/api/banners/${x.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayOrder: x.order }),
            cache: "no-store",
          }).then((res) => res.ok).catch(() => false)
        )
      );
      if (results.every(Boolean)) {
        setRows((p) => p.map((x) => ordered.find((o) => o.id === x.id) ?? x));
      } else {
        setPageError("Could not save the new order. Order unchanged.");
      }
    } catch {
      setPageError("Cannot reach the server. Order unchanged.");
    }
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
        <p className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-bold ${saved.endsWith("no code needed.") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`} role="status">
          {saved.endsWith("no code needed.") ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <TriangleAlert className="h-4 w-4 shrink-0" />} {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search banners…" />
        <FilterBar value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </AdminToolbar>
      {pageError ? (
        <p className="mt-3 rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">
          {pageError}
        </p>
      ) : null}
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
                <button onClick={() => void toggleActive(b)} aria-label={`Toggle visibility of ${b.title}`} aria-pressed={b.active}>
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
                <button onClick={() => void move(b, -1)} aria-label="Move up" className="rounded-lg border border-silver-300 p-1.5 text-navy-700 hover:border-teal-500">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => void move(b, 1)} aria-label="Move down" className="rounded-lg border border-silver-300 p-1.5 text-navy-700 hover:border-teal-500">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => void remove(b)} className="inline-flex items-center gap-1 rounded-lg border border-crimson-100 px-2.5 py-1.5 text-[12px] font-bold text-crimson hover:bg-crimson-50">
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
        <CloudinaryUpload
          category="banners"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          resourceType="image"
          label="Banner image"
          buttonLabel={form.image ? "Replace banner image" : "Upload banner image"}
          onUploadComplete={(url) => setForm((f) => ({ ...f, image: url }))}
        />
        <CloudinaryUpload
          category="banners"
          accept="video/mp4,video/mov,video/webm,video/avi,video/mkv"
          resourceType="video"
          label="Banner video"
          buttonLabel={form.videoUrl ? "Replace banner video" : "Upload banner video"}
          onUploadComplete={(url) => setForm((f) => ({ ...f, videoUrl: url }))}
        />
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Description
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Small batches, weekly mocks…" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-teal-500" />
        </label>
        {/* Motion / Animation Style — admin-visible entrance effects. */}
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-navy-700">
            <Sparkles className="h-3.5 w-3.5 text-teal-600" /> Motion / Animation Style
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {BANNER_ANIMATIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.hint}
                aria-pressed={form.animation === opt.value}
                onClick={() => set("animation", opt.value)}
                className={`rounded-xl border px-3 py-2 text-left text-[12px] font-bold transition ${form.animation === opt.value ? "border-teal-500 bg-teal-50 text-teal-700" : "border-silver-300 bg-white text-navy-700 hover:border-teal-400"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">{BANNER_ANIMATIONS.find((o) => o.value === form.animation)?.hint}</p>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold tracking-widest text-muted">LIVE PREVIEW</p>
          <BannerPreview b={form} />
        </div>
        {formError ? (
          <p className="mt-3 rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson" role="alert">{formError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void save()}>
            Save Banner
          </Button>
        </div>
      </AdminModal>

      <AdminModal open={preview !== null} title="Banner Preview" onClose={() => setPreview(null)} wide>
        {preview ? <BannerPreview b={preview} /> : null}
      </AdminModal>
    </AdminLayout>
  );
}
