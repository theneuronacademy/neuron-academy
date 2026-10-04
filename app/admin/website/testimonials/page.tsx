"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { TESTIMONIALS } from "@/data/testimonials";

interface Row {
  id: string;
  studentName: string;
  course: string;
  achievement: string;
  active: boolean;
}

export default function TestimonialsAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    // TODO backend: GET /api/admin/website/testimonials
    setRows(TESTIMONIALS.map((t) => ({ id: t.id, studentName: t.studentName, course: t.course, achievement: t.achievement, active: true })));
    setReady(true);
  }, [router]);

  const filtered = useMemo(() => rows.filter((r) => !search.trim() || `${r.studentName} ${r.course}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  if (!ready) {
    return (
      <AdminLayout title="Testimonials" subtitle="Website → Testimonials">
        <LoadingState message="Loading testimonials…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Testimonials" subtitle="Student success quotes">
      <AdminPageHeader title="Testimonials" description="Quotes shown on the homepage carousel." actionLabel="Add Testimonial" actionIcon={Plus} onAction={() => { setName(""); setModal(true); }} />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search testimonials…" />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No testimonials" desc="Add the first verified student quote." />
      ) : (
        <AdminTable<Row>
          columns={[
            { key: "n", header: "Student", render: (r) => <span className="font-extrabold text-navy-700">{r.studentName}</span> },
            { key: "c", header: "Course", render: (r) => r.course },
            { key: "a", header: "Achievement", render: (r) => <span className="text-muted">{r.achievement}</span> },
            {
              key: "s",
              header: "Status",
              render: (r) => (
                <button onClick={() => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)))}>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${r.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-silver-200 bg-silver-50 text-muted"}`}>
                    {r.active ? "Active" : "Hidden"}
                  </span>
                </button>
              ),
            },
            {
              key: "x",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button aria-label={`Edit ${r.studentName}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete testimonial from "${r.studentName}"?`)) setRows((p) => p.filter((x) => x.id !== r.id));
                    }}
                    aria-label={`Delete ${r.studentName}`}
                    className="rounded-lg border border-crimson-100 p-2 text-crimson-DEFAULT hover:bg-crimson-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
        />
      )}
      <AdminModal open={modal} title="Add Testimonial" onClose={() => setModal(false)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Student name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="e.g. Ayan Khan — JEE" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (!name.trim()) return;
              setRows((p) => [...p, { id: `t-${Date.now()}`, studentName: name.trim(), course: "JEE Main + Advanced", achievement: "—", active: true }]);
              setModal(false);
              setSaved("Testimonial added (demo).");
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
