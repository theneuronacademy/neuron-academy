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
  const [category, setCategory] = useState("Engineering");
  const [duration, setDuration] = useState("1 year");
  const [mode, setMode] = useState("Offline + Online");
  const [saved, setSaved] = useState<string | null>(null);
  // Phase 17 — persistence errors surface honestly (no local writes).
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/courses", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows((json.data.items as Array<{ id: string; name?: string; category?: string; duration?: string; mode?: string; isActive?: boolean; admissionOpen?: boolean }>).map((c) => ({
            id: c.id,
            name: c.name ?? "",
            category: c.category ?? "Engineering",
            duration: c.duration ?? "1 year",
            mode: c.mode ?? "Offline + Online",
            admissionOpen: c.isActive ?? c.admissionOpen ?? true,
          })));
        } else {
          const { COURSES, COURSE_CATEGORIES } = await import("@/data/courses");
          setRows(COURSES.map((c) => ({ id: c.id, name: c.name, category: c.category, duration: c.duration, mode: c.mode, admissionOpen: c.admissionOpen })));
        }
      } catch {
        const { COURSES, COURSE_CATEGORIES } = await import("@/data/courses");
        setRows(COURSES.map((c) => ({ id: c.id, name: c.name, category: c.category, duration: c.duration, mode: c.mode, admissionOpen: c.admissionOpen })));
      }
      setReady(true);
    })();
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
    setCategory("Engineering");
    setDuration("1 year");
    setMode("Offline + Online");
    setModal(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setName(r.name);
    setCategory(r.category);
    setDuration(r.duration);
    setMode(r.mode);
    setModal(true);
  };
  const save = async () => {
    if (!name.trim()) return;
    // Phase 17 — courses persist via the API only (no local writes).
    setFormError(null);
    const payload = { name: name.trim(), category: category.trim(), duration: duration.trim(), mode: mode.trim(), isActive: true };
    try {
      if (editing) {
        const res = await fetch(`/api/courses/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success !== false) {
          setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, name: name.trim(), category: category.trim(), duration: duration.trim(), mode: mode.trim() } : r)));
          setSaved("Course updated.");
          setModal(false);
        } else {
          setFormError(json?.error ?? "Could not update course. Nothing was saved.");
          return;
        }
      } else {
        const res = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.data?.item) {
          const item = json.data.item;
          setRows((p) => [...p, { id: item.id, name: item.name, category: item.category ?? "Engineering", duration: item.duration ?? "1 year", mode: item.mode ?? "Offline + Online", admissionOpen: true }]);
          setSaved("Course added.");
          setModal(false);
        } else {
          const errJson = await res.json().catch(() => null);
          setFormError(errJson?.error ?? "Could not add course. Nothing was saved.");
          return;
        }
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
      return;
    }
    setModal(false);
    window.setTimeout(() => setSaved(null), 2500);
  };
  const remove = async (r: Row) => {
    if (!window.confirm(`Delete "${r.name}" from the website? Courses with batches, students or enquiries cannot be deleted — deactivate them instead.`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/courses/${r.id}`, { method: "DELETE", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Course removed.");
      } else {
        // Phase 17 — 409 dependency guard message reaches the admin verbatim.
        setPageError(json?.error ?? "Could not delete course. Nothing was deleted.");
      }
    } catch {
      setPageError("Cannot reach the server. Nothing was deleted.");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };
  // Phase 17 — admission toggle persists as course status (controls catalogue).
  const toggle = async (r: Row) => {
    setPageError(null);
    const next = !r.admissionOpen;
    try {
      const res = await fetch(`/api/courses/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next ? "ACTIVE" : "INACTIVE" }),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success !== false) {
        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, admissionOpen: next } : x)));
      } else {
        setPageError(json?.error ?? "Could not change admission status.");
      }
    } catch {
      setPageError("Cannot reach the server. Status unchanged.");
    }
  };

  if (!ready) {
    return (
      <AdminLayout title="Courses" subtitle="Website → Courses">
        <LoadingState message="Loading courses…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Courses" subtitle="Control the public course catalogue">
      <AdminPageHeader title="Website Courses" description={`${filtered.length} of ${rows.length} courses • changes reflect on the homepage immediately.`} actionLabel="Add Course" actionIcon={Plus} onAction={openAdd} />
      {pageError ? (
        <p className="rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">
          {pageError}
        </p>
      ) : null}
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search courses…" />
        <FilterBar value={cat} onChange={setCat} ariaLabel="Filter by category" options={[{ value: "all", label: "All categories" }, { value: "Engineering", label: "Engineering" }, { value: "Medical", label: "Medical" }, { value: "Foundation", label: "Foundation" }, { value: "School", label: "School" }]} />
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
                <button onClick={() => void toggle(r)} title="Toggle admission" aria-pressed={r.admissionOpen}>
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
                  <button onClick={() => void remove(r)} aria-label={`Delete ${r.name}`} className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50">
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
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] font-bold text-navy-700">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500">
              <option value="Engineering">Engineering</option>
              <option value="Medical">Medical</option>
              <option value="Foundation">Foundation</option>
              <option value="School">School</option>
            </select>
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Duration
            <input value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="1 year" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500">
              <option value="Offline + Online">Offline + Online</option>
              <option value="Offline">Offline</option>
              <option value="Online">Online</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-[12px] text-muted">Only these fields are editable here. Admission status toggles from the table.</p>
        {formError ? (
          <p className="rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson" role="alert">{formError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void save()}>
            Save
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}