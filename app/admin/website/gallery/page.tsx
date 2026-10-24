"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CheckCircle2, Eye, ArrowUp, ArrowDown, Sparkles, TriangleAlert, Image as ImageIcon, Video } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState, ErrorState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { CloudinaryUpload } from "@/components/admin/CloudinaryUpload";
import { CloudinaryVideoUpload } from "@/components/admin/CloudinaryVideoUpload";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { BANNER_ANIMATIONS, bannerAnimationClass, toBannerAnimation } from "@/components/website/bannerMotion";
import { GALLERY_CATEGORIES } from "@/data/gallery";

interface GalleryRow {
  id: string;
  title: string;
  caption: string;
  altText: string;
  category: string;
  mediaType: "image" | "video";
  image: string;
  publicId: string;
  videoUrl: string;
  videoPublicId: string;
  animation: string;
  active: boolean;
  order: number;
}

const EMPTY: Omit<GalleryRow, "id"> = {
  title: "",
  caption: "",
  altText: "",
  category: "Academy",
  mediaType: "image",
  image: "",
  publicId: "",
  videoUrl: "",
  videoPublicId: "",
  animation: "none",
  active: true,
  order: 1,
};

interface GalleryFormRow extends Omit<GalleryRow, "id"> {
  id?: string;
}

function MediaTile({ r, className = "" }: { r: Pick<GalleryRow, "mediaType" | "image" | "videoUrl" | "title">; className?: string }) {
  const isVideo = r.mediaType === "video";
  const hasVideo = isVideo && Boolean(r.videoUrl);
  const hasImage = !isVideo && Boolean(r.image);
  return (
    <div className={`relative overflow-hidden bg-navy-800 ${className}`}>
      {hasVideo ? (
        <video src={r.videoUrl} controls preload="metadata" playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.image} alt={r.title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-navy-700 to-navy-900 p-4 text-center">
          {isVideo ? <Video className="h-6 w-6 text-white/70" /> : <ImageIcon className="h-6 w-6 text-white/70" />}
          <span className="text-sm font-extrabold text-white">{r.title || (isVideo ? "Video item" : "Photo item")}</span>
        </div>
      )}
      {isVideo && hasImage ? (
        <span className="absolute right-2 top-2 rounded-lg bg-navy-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white">VIDEO</span>
      ) : null}
    </div>
  );
}

function MediaPreview({ r }: { r: GalleryFormRow }) {
  const animationClass = r.animation && r.animation !== "none" ? bannerAnimationClass(r.animation) : "";
  return (
    <div className="overflow-hidden rounded-2xl border border-silver-300 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-silver-200 bg-silver-50 px-3 py-2">
        <p className="text-[11px] font-bold text-muted">PREVIEW • ACADEMY GALLERY</p>
        <AdminStatusBadge tone={r.active ? "green" : "gray"}>{r.active ? "Active" : "Inactive"}</AdminStatusBadge>
      </div>
      <div className="flex items-start justify-center gap-6 bg-slate-100 p-6 max-md:flex-col">
        <MediaTile r={r} className={`h-44 w-full max-w-72 rounded-xl shadow-card ${animationClass}`} />
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-widest text-teal-600">{r.category.toUpperCase()} • ORDER {r.order}</p>
          <p className="mt-1 text-[15px] font-extrabold text-navy-700">{r.title || "Photo title"}</p>
          <p className="mt-1 text-[13px] text-muted">{r.caption || "Caption appears here on the gallery."}</p>
          <p className="mt-2 text-[11px] text-muted">
            {BANNER_ANIMATIONS.find((o) => o.value === r.animation)?.label ?? "No motion"} entrance effect.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<GalleryRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<GalleryRow | null>(null);
  const [form, setForm] = useState<GalleryFormRow>(EMPTY);
  const [preview, setPreview] = useState<GalleryRow | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // Persistence errors surface honestly (no local writes).
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    if (!isAdmin) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/gallery", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows(
            (json.data.items as Array<{ id: string; title?: string; imageUrl?: string; videoUrl?: string; publicId?: string; videoPublicId?: string; caption?: string; altText?: string; mediaType?: string; category?: string; isActive?: boolean; displayOrder?: number; animation?: string }>).map((b) => ({
              id: b.id,
              title: b.title ?? "",
              caption: b.caption ?? "",
              altText: b.altText ?? "",
              category: b.category ?? "Academy",
              mediaType: b.mediaType === "video" ? "video" : "image",
              image: b.imageUrl ?? "",
              publicId: b.publicId ?? "",
              videoUrl: b.videoUrl ?? "",
              videoPublicId: b.videoPublicId ?? "",
              animation: toBannerAnimation(b.animation),
              active: b.isActive ?? true,
              order: b.displayOrder ?? 0,
            }))
          );
          if (typeof json.data.warning === "string" && json.data.warning) setNotice(json.data.warning);
        } else {
          setListError(json?.error ?? "Could not load gallery items.");
        }
      } catch {
        setListError("Cannot reach the server. Gallery items unavailable.");
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
            (mediaFilter === "all" || r.mediaType === mediaFilter) &&
            (!search.trim() || `${r.title} ${r.caption} ${r.category}`.toLowerCase().includes(search.toLowerCase()))
        ),
    [rows, search, filter, mediaFilter]
  );

  const set = (k: keyof Omit<GalleryRow, "id">, v: string | boolean | number) => setForm((f) => ({ ...f, [k]: v }));
  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY, order: rows.length + 1 });
    setFormError(null);
    setModal(true);
  };
  const openEdit = (r: GalleryRow) => {
    setEditing(r);
    setForm({ ...r });
    setFormError(null);
    setModal(true);
  };
  const payloadFor = (f: GalleryFormRow) => ({
    title: f.title,
    caption: f.caption || undefined,
    altText: f.altText || undefined,
    imageUrl: f.mediaType === "image" ? f.image : undefined,
    publicId: f.mediaType === "image" ? f.publicId : "",
    videoUrl: f.mediaType === "video" ? f.videoUrl : undefined,
    videoPublicId: f.mediaType === "video" ? f.videoPublicId : "",
    mediaType: f.mediaType,
    category: f.category,
    displayOrder: f.order,
    isActive: f.active,
    animation: toBannerAnimation(f.animation),
  });
  const mapItemToRow = (item: Record<string, unknown>): GalleryRow => ({
    id: String(item.id),
    title: String(item.title ?? ""),
    caption: String(item.caption ?? ""),
    altText: String(item.altText ?? ""),
    category: String(item.category ?? "Academy"),
    mediaType: item.mediaType === "video" ? "video" : "image",
    image: String(item.imageUrl ?? ""),
    publicId: String(item.publicId ?? ""),
    videoUrl: String(item.videoUrl ?? ""),
    videoPublicId: String(item.videoPublicId ?? ""),
    animation: toBannerAnimation(item.animation),
    active: Boolean(item.isActive ?? true),
    order: Number(item.displayOrder ?? 0),
  });

  const save = async () => {
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (form.mediaType === "image" && !form.image.trim()) {
      setFormError("Upload a photo or paste a photo URL before saving an image item.");
      return;
    }
    if (form.mediaType === "video" && !form.videoUrl.trim()) {
      setFormError("Upload a video or paste a video URL before saving a video item.");
      return;
    }
    setFormError(null);
    try {
      const res = editing
        ? await fetch(`/api/gallery/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadFor(form)),
            cache: "no-store",
          })
        : await fetch("/api/gallery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadFor(form)),
            cache: "no-store",
          });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data?.item) {
        const row = mapItemToRow(json.data.item);
        setRows((p) => (editing ? p.map((r) => (r.id === editing.id ? row : r)) : [...p, row]));
        if (typeof json.warning === "string" && json.warning) setNotice(json.warning);
        setSaved(editing ? "Gallery item updated." : "Gallery item created.");
        setModal(false);
      } else {
        setFormError(json?.error ?? "Could not save the gallery item. Nothing was saved.");
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
    }
    window.setTimeout(() => setSaved(null), 3000);
  };
  const remove = async (r: GalleryRow) => {
    if (!window.confirm(`Delete "${r.title}" from the gallery? This cannot be undone.`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/gallery/${r.id}`, { method: "DELETE", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        if (typeof json?.warning === "string" && json.warning) setNotice(json.warning);
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Gallery item deleted.");
      } else {
        setPageError(json?.error ?? "Could not delete the gallery item. Nothing was deleted.");
      }
    } catch {
      setPageError("Cannot reach the server. Nothing was deleted.");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };
  const toggleActive = async (r: GalleryRow) => {
    // Publish/unpublish persists immediately (controls the public website).
    setPageError(null);
    const next = !r.active;
    try {
      const res = await fetch(`/api/gallery/${r.id}`, {
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
  const move = async (r: GalleryRow, dir: -1 | 1) => {
    // Ordering persists via displayOrder PATCHes.
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
          fetch(`/api/gallery/${x.id}`, {
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
      <AdminLayout title="Gallery" subtitle="Website → Gallery">
        <LoadingState message="Loading gallery…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Gallery" subtitle="Academy media — wording, order and entry effects are admin-managed">
      <AdminPageHeader
        title="Gallery / Media Manager"
        description={`${filtered.length} items • images AND videos share one section; display order controls the homepage sequence.`}
        actionLabel="Add Media"
        actionIcon={Plus}
        onAction={openAdd}
      />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-bold" role="status">
          {saved === "Gallery item created." || saved === "Gallery item updated." || saved === "Gallery item deleted." ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-emerald-700">{saved}</span>
            </>
          ) : (
            <>
              <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="text-amber-800">{saved}</span>
            </>
          )}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] font-bold text-amber-800" role="status">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
          <button type="button" onClick={() => setNotice(null)} className="ml-auto text-[11px] underline">
            Dismiss
          </button>
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search gallery items…" />
        <FilterBar
          value={mediaFilter}
          onChange={setMediaFilter}
          ariaLabel="Filter by media type"
          options={[{ value: "all", label: "All media" }, { value: "image", label: "Photos" }, { value: "video", label: "Videos" }]}
        />
        <FilterBar
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter by visibility"
          options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
        />
      </AdminToolbar>
      {pageError ? (
        <p className="mt-3 rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">
          {pageError}
        </p>
      ) : null}
      {listError ? (
        <ErrorState message={listError} onRetry={() => window.location.reload()} />
      ) : null}
      {!listError && filtered.length === 0 ? (
        <EmptyState
          title="No gallery items"
          desc="Add photos and videos of the academy life — uploads go to Cloudinary, order and entry effects are per-item."
          action={<Button variant="primary" size="sm" onClick={openAdd}>Add Media</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((r) => (
            <div key={r.id} className="flex gap-3 rounded-card border border-silver-200 bg-white p-3 shadow-card">
              <MediaTile r={r} className="h-24 w-28 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-muted">
                      ORDER {r.order} • {r.category.toUpperCase()} • {r.mediaType === "video" ? "VIDEO" : "PHOTO"}
                    </p>
                    <p className="mt-0.5 truncate text-[15px] font-extrabold text-navy-700">{r.title}</p>
                    <p className="truncate text-[12px] text-muted">{r.caption || (r.mediaType === "video" ? "Video — plays in the gallery lightbox." : "Photo — opens in the gallery lightbox.")}</p>
                  </div>
                  <button onClick={() => void toggleActive(r)} aria-label={`Toggle visibility of ${r.title}`} aria-pressed={r.active}>
                    <AdminStatusBadge tone={r.active ? "green" : "gray"}>{r.active ? "Active" : "Inactive"}</AdminStatusBadge>
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button onClick={() => setPreview(r)} className="inline-flex items-center gap-1 rounded-lg border border-silver-300 px-2.5 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500">
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                  <button onClick={() => openEdit(r)} className="inline-flex items-center gap-1 rounded-lg border border-silver-300 px-2.5 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => void move(r, -1)} aria-label={`Move ${r.title} up`} className="rounded-lg border border-silver-300 p-1.5 text-navy-700 hover:border-teal-500">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => void move(r, 1)} aria-label={`Move ${r.title} down`} className="rounded-lg border border-silver-300 p-1.5 text-navy-700 hover:border-teal-500">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => void remove(r)} className="inline-flex items-center gap-1 rounded-lg border border-crimson-100 px-2.5 py-1.5 text-[12px] font-bold text-crimson hover:bg-crimson-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminModal open={modal} title={editing ? "Edit Gallery Media" : "Add Gallery Media"} onClose={() => setModal(false)} wide>
        <div className="mb-3">
          <p className="text-[12px] font-bold text-navy-700">Media type</p>
          <div className="mt-1.5 flex gap-2">
            {(["image", "video"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={form.mediaType === t}
                onClick={() => set("mediaType", t)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-bold transition ${form.mediaType === t ? "border-teal-500 bg-teal-50 text-teal-700" : "border-silver-300 bg-white text-navy-700 hover:border-teal-400"}`}
              >
                {t === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                {t === "image" ? "Photo" : "Video"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] font-bold text-navy-700">
            Title *
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Chemistry lab session"
              className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-teal-500"
            />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Category
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-teal-500"
            >
              {GALLERY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-bold text-navy-700 sm:col-span-2">
            Caption (optional)
            <input
              value={form.caption}
              onChange={(e) => set("caption", e.target.value)}
              placeholder="Shows under the item on the website"
              className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-teal-500"
            />
          </label>
          <label className="block text-[12px] font-bold text-navy-700 sm:col-span-2">
            Alt text (optional, accessibility)
            <input
              value={form.altText}
              onChange={(e) => set("altText", e.target.value)}
              placeholder="Describe the photo for screen readers"
              className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-teal-500"
            />
          </label>
        </div>
        <div className="mt-2">
          {form.mediaType === "image" ? (
            <>
              <CloudinaryUpload
                category="gallery"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                resourceType="image"
                label="Photo upload"
                buttonLabel={form.image ? "Replace photo" : "Upload photo"}
                onUploadComplete={(url, publicId) => setForm((f) => ({ ...f, image: url, publicId: publicId || f.publicId }))}
              />
              <label className="mt-2 block text-[12px] font-bold text-navy-700">
                Photo URL (optional fallback)
                <input
                  value={form.image}
                  onChange={(e) => set("image", e.target.value)}
                  placeholder="https://… or leave after uploading"
                  className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-teal-500"
                />
              </label>
            </>
          ) : (
            <>
              <CloudinaryVideoUpload
                category="gallery"
                label="Video upload"
                buttonLabel={form.videoUrl ? "Replace video" : "Upload video"}
                onUploadComplete={(url, publicId) => setForm((f) => ({ ...f, videoUrl: url, videoPublicId: publicId || f.videoPublicId }))}
              />
              <label className="mt-2 block text-[12px] font-bold text-navy-700">
                Video URL (optional fallback)
                <input
                  value={form.videoUrl}
                  onChange={(e) => set("videoUrl", e.target.value)}
                  placeholder="https://… or leave after uploading"
                  className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-teal-500"
                />
              </label>
            </>
          )}
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] font-bold text-navy-700">
            Display order
            <input
              value={form.order}
              onChange={(e) => set("order", Number(e.target.value) || 1)}
              type="number"
              min={1}
              className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2.5 text-[13px] font-bold text-navy-700">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-teal-600" /> Active (visible on website)
          </label>
        </div>
        {/* Motion / Animation Style — per-item entrance effect on the website. */}
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
          <p className="mt-1.5 text-[11px] text-muted">
            {BANNER_ANIMATIONS.find((o) => o.value === form.animation)?.hint ?? "Item appears without motion (best for low-motion devices)."}
          </p>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold tracking-widest text-muted">LIVE PREVIEW</p>
          <MediaPreview r={form} />
        </div>
        {formError ? (
          <p className="mt-3 rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson" role="alert">{formError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void save()}>
            {editing ? "Save Changes" : "Add Media"}
          </Button>
        </div>
      </AdminModal>

      <AdminModal open={preview !== null} title="Gallery Preview" onClose={() => setPreview(null)} wide>
        {preview ? <MediaPreview r={preview} /> : null}
      </AdminModal>
    </AdminLayout>
  );
}
