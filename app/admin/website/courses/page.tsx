"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { COURSES, COURSE_CATEGORIES } from "@/data/courses";

interface Row {
  id: string;
  name: string;
  category: string;
  duration: string;
  mode: string;
  admissionOpen: boolean;
}

export default function WebsiteCoursesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    // TODO backend: GET /api/admin/website/courses (today: public catalogue as source of truth)
    setRows(COURSES.map((c) => ({ id: c.id, name: c.name, category: c.category, duration: c.duration, mode: c.mode, admissionOpen: c.admissionOpen })));
    setReady(true);
  }, [router]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (cat === "all" || r.category === cat) &&
          (!search.trim() || `${r.name} ${r.category}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [rows, search, cat]
  );

  const openAdd = () => {
    setEditing(null);
    setName("");
    setModal(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setName(r.name);
    setModal(true);
  };
  const save = () => {
    if (!name.trim()) return;
    if (editing) setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, name: name.trim() } : r)));
    else setRows((p) => [...p, { id: `c-${Date.now()}`, name: name.trim(), category: "Engineering", duration: "1 year", mode: "Offline + Online", admissionOpen: true }]);
    setModal(false);
    setSaved(editing ? "Course updated (demo — backend sync later)." : "Course added (demo — backend sync later).");
    window.setTimeout(() => setSaved(null), 2500);
  };
  const remove = (r: Row) => {
    if (!window.confirm(`Delete "${r.name}" from the website?`)) return;
    setRows((p) => p.filter((x) => x.id !== r.id));
    setSaved("Course removed (demo).");
    window.setTimeout(() => setSaved(null), 2500);
  };
  const toggle = (r: Row) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, admissionOpen: !x.admissionOpen } : x)));

  if (!ready) {
    return (
      <AdminLayout title="Courses" subtitle="Website → Courses">
        <LoadingState message="Loading courses…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Courses" subtitle="Control the public course catalogue">
      <AdminPageHeader title="Website Courses" description={`${filtered.length} of ${rows.length} courses • changes reflect on homepage after backend sync.`} actionLabel="Add Course" actionIcon={Plus} onAction={openAdd} />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search courses…" />
        <FilterBar value={cat} onChange={setCat} ariaLabel="Filter by category" options={[{ value: "all", label: "All categories" }, ...COURSE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No courses match" desc="Try a different search or category." />
      ) : (
        <AdminTable<Row>
          columns={[
            { key: "name", header: "Course", render: (r) => <span className="font-extrabold text-navy-700">{r.name}</span> },
            { key: "cat", header: "Category", render: (r) => <span className="text-muted">{r.category}</span> },
            { key: "dur", header: "Duration", render: (r) => r.duration },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <button onClick={() => toggle(r)} title="Toggle admission">
                  <AdminStatusBadge tone={r.admissionOpen ? "green" : "gray"}>{r.admissionOpen ? "Admission open" : "Closed"}</AdminStatusBadge>
                </button>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => openEdit(r)} aria-label={`Edit ${r.name}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(r)} aria-label={`Delete ${r.name}`} className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
        />
      )}
      <AdminModal open={modal} title={editing ? "Edit Course" : "Add Course"} onClose={() => setModal(false)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Course name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. JEE Main + Advanced" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </label>
        <p className="mt-2 text-[12px] text-muted">Full field set (category, duration, faculty, subjects) arrives with the backend form schema.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save}>
            Save (demo)
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
