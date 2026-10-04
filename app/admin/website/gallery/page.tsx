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
import { GALLERY, GALLERY_CATEGORIES } from "@/data/gallery";

interface Row {
  id: string;
  title: string;
  category: string;
}

export default function GalleryAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    // TODO backend: GET /api/admin/website/gallery
    setRows(GALLERY.map((g) => ({ id: g.id, title: g.title, category: g.category })));
    setReady(true);
  }, [router]);

  const filtered = useMemo(
    () => rows.filter((r) => (cat === "all" || r.category === cat) && (!search.trim() || r.title.toLowerCase().includes(search.toLowerCase()))),
    [rows, search, cat]
  );

  if (!ready) {
    return (
      <AdminLayout title="Gallery" subtitle="Website → Gallery">
        <LoadingState message="Loading gallery…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Gallery" subtitle="Homepage photo wall">
      <AdminPageHeader title="Gallery" description={`${filtered.length} of ${rows.length} photos.`} actionLabel="Add Photo" actionIcon={Plus} onAction={() => { setTitle(""); setModal(true); }} />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search photos…" />
        <FilterBar value={cat} onChange={setCat} options={[{ value: "all", label: "All categories" }, ...GALLERY_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No photos" desc="Upload the first gallery photo." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((g) => (
            <div key={g.id} className="overflow-hidden rounded-card border border-silver-200 bg-white shadow-card">
              <div className="metallic-dark flex h-32 items-center justify-center p-3 text-center text-[12px] font-extrabold text-white">{g.title}</div>
              <div className="flex items-center justify-between gap-2 p-3">
                <span className="truncate text-[12px] font-bold text-muted">{g.category}</span>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${g.title}"?`)) setRows((p) => p.filter((x) => x.id !== g.id));
                  }}
                  aria-label={`Delete ${g.title}`}
                  className="rounded-lg border border-crimson-100 p-1.5 text-crimson-DEFAULT hover:bg-crimson-50"
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
        <p className="mt-2 text-[12px] text-muted">Image upload wires to storage in the backend phase.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (!title.trim()) return;
              setRows((p) => [...p, { id: `g-${Date.now()}`, title: title.trim(), category: "Academy" }]);
              setModal(false);
              setSaved("Photo added (demo).");
              window.setTimeout(() => setSaved(null), 2500);
            }}
          >
            Save (demo)
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
