"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getBanners } from "@/services/adminApi";

interface Row {
  id: string;
  title: string;
  category: string;
  image: string;
}

export default function GalleryAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/gallery", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows(json.data.items.map((g: any) => ({
            id: g.id,
            title: g.title ?? "",
            category: g.category ?? "Academy",
            image: g.imageUrl ?? "",
          })));
        } else {
          // fallback to local data
          const { GALLERY, GALLERY_CATEGORIES } = await import("@/data/gallery");
          setRows(GALLERY.map((g) => ({ id: g.id, title: g.title, category: g.category, image: g.imageUrl ?? "" })));
        }
      } catch {
        const { GALLERY, GALLERY_CATEGORIES } = await import("@/data/gallery");
        setRows(GALLERY.map((g) => ({ id: g.id, title: g.title, category: g.category, image: g.imageUrl ?? "" })));
      }
      setReady(true);
    })();
  }, [router]);

  const filtered = useMemo(
    () => rows.filter((r) => (cat === "all" || r.category === cat) && (!search.trim() || r.title.toLowerCase().includes(search.toLowerCase()))),
    [rows, search, cat]
  );

  const save = async () => {
    if (!title.trim()) return;
    const payload = { title: title.trim(), imageUrl: imageUrl || undefined, category: "Academy", isActive: true };
    try {
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data?.item) {
        const item = json.data.item;
        setRows((p) => [...p, { id: item.id, title: item.title, category: item.category ?? "Academy", image: item.imageUrl ?? "" }]);
        setSaved("Photo added.");
      } else {
        setRows((p) => [...p, { id: `g-${Date.now()}`, title: title.trim(), category: "Academy", image: imageUrl }]);
        setSaved("Photo added locally (database unavailable).");
      }
    } catch {
      setRows((p) => [...p, { id: `g-${Date.now()}`, title: title.trim(), category: "Academy", image: imageUrl }]);
      setSaved("Saved locally (database unavailable).");
    }
    setModal(false);
    setTitle("");
    setImageUrl("");
    window.setTimeout(() => setSaved(null), 2500);
  };

  const remove = async (g: Row) => {
    if (!window.confirm(`Delete "${g.title}"?`)) return;
    try {
      const res = await fetch(`/api/gallery/${g.id}`, { method: "DELETE", cache: "no-store" });
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== g.id));
        setSaved("Photo deleted.");
      } else {
        setRows((p) => p.filter((x) => x.id !== g.id));
        setSaved("Deleted locally (database unavailable).");
      }
    } catch {
      setRows((p) => p.filter((x) => x.id !== g.id));
      setSaved("Deleted locally (database unavailable).");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };

  if (!ready) {
    return (
      <AdminLayout title="Gallery" subtitle="Website → Gallery">
        <LoadingState message="Loading gallery…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Gallery" subtitle="Homepage photo wall">
      <AdminPageHeader title="Gallery" description={`${filtered.length} of ${rows.length} photos.`} actionLabel="Add Photo" actionIcon={Plus} onAction={() => { setTitle(""); setImageUrl(""); setModal(true); }} />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search photos…" />
        <FilterBar value={cat} onChange={setCat} options={[{ value: "all", label: "All categories" }, { value: "Academy", label: "Academy" }, { value: "Campus", label: "Campus" }, { value: "Events", label: "Events" }, { value: "Achievements", label: "Achievements" }]} />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No photos" desc="Upload the first gallery photo." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((g) => (
            <div key={g.id} className="overflow-hidden rounded-card border border-silver-200 bg-white shadow-card">
              <div className="relative aspect-square">
                {g.image ? (
                  <img src={g.image} alt={g.title} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="metallic-dark flex h-full items-center justify-center p-3 text-center text-[12px] font-extrabold text-white">{g.title}</div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <span className="truncate text-[12px] font-bold text-muted">{g.category}</span>
                <button
                  onClick={() => remove(g)}
                  aria-label={`Delete ${g.title}`}
                  className="rounded-lg border border-crimson-100 p-1.5 text-crimson hover:bg-crimson-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <AdminModal open={modal} title="Add Photo" onClose={() => setModal(false)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Photo title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Classroom Session" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Image URL
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </label>
        <p className="mt-2 text-[12px] text-muted">Upload wires to Supabase Storage in production.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save}>
            Save
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
