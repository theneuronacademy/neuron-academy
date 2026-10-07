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
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [achievement, setAchievement] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/testimonials", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows(json.data.items.map((t: any) => ({
            id: t.id,
            studentName: t.studentName ?? t.name ?? "",
            course: t.course ?? "",
            achievement: t.achievement ?? "",
            active: t.isActive ?? true,
          })));
        } else {
          const { TESTIMONIALS } = await import("@/data/testimonials");
          setRows(TESTIMONIALS.map((t) => ({ id: t.id, studentName: t.studentName, course: t.course, achievement: t.achievement, active: true })));
        }
      } catch {
        const { TESTIMONIALS } = await import("@/data/testimonials");
        setRows(TESTIMONIALS.map((t) => ({ id: t.id, studentName: t.studentName, course: t.course, achievement: t.achievement, active: true })));
      }
      setReady(true);
    })();
  }, [router]);

  const filtered = useMemo(() => rows.filter((r) => !search.trim() || `${r.studentName} ${r.course}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const save = async () => {
    if (!name.trim()) return;
    const payload = { studentName: name.trim(), course: course.trim(), achievement: achievement.trim(), isActive: true };
    try {
      if (editing) {
        const res = await fetch(`/api/testimonials/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        if (res.ok) {
          setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, studentName: name.trim(), course: course.trim(), achievement: achievement.trim() } : r)));
          setSaved("Testimonial updated.");
        } else {
          setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, studentName: name.trim(), course: course.trim(), achievement: achievement.trim() } : r)));
          setSaved("Testimonial updated locally (database unavailable).");
        }
      } else {
        const res = await fetch("/api/testimonials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.data?.item) {
          const item = json.data.item;
          setRows((p) => [...p, { id: item.id, studentName: item.studentName, course: item.course ?? "", achievement: item.achievement ?? "", active: true }]);
          setSaved("Testimonial added.");
        } else {
          setRows((p) => [...p, { id: `t-${Date.now()}`, studentName: name.trim(), course: course.trim(), achievement: achievement.trim(), active: true }]);
          setSaved("Testimonial added locally (database unavailable).");
        }
      }
    } catch {
      if (editing) setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, studentName: name.trim(), course: course.trim(), achievement: achievement.trim() } : r)));
      else setRows((p) => [...p, { id: `t-${Date.now()}`, studentName: name.trim(), course: course.trim(), achievement: achievement.trim(), active: true }]);
      setSaved("Saved locally (database unavailable).");
    }
    setModal(false);
    setEditing(null);
    setName("");
    setCourse("");
    setAchievement("");
    window.setTimeout(() => setSaved(null), 2500);
  };

  const remove = async (r: Row) => {
    if (!window.confirm(`Delete testimonial from "${r.studentName}"?`)) return;
    try {
      const res = await fetch(`/api/testimonials/${r.id}`, { method: "DELETE", cache: "no-store" });
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Testimonial deleted.");
      } else {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Deleted locally (database unavailable).");
      }
    } catch {
      setRows((p) => p.filter((x) => x.id !== r.id));
      setSaved("Deleted locally (database unavailable).");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };

  if (!ready) {
    return (
      <AdminLayout title="Testimonials" subtitle="Website → Testimonials">
        <LoadingState message="Loading testimonials…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Testimonials" subtitle="Student success quotes">
      <AdminPageHeader title="Testimonials" description="Quotes shown on the homepage carousel." actionLabel="Add Testimonial" actionIcon={Plus} onAction={() => { setEditing(null); setName(""); setCourse(""); setAchievement(""); setModal(true); }} />
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
              render: (r) => {
                return (
                  <button onClick={() => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)))}>
                    <span className={r.active ? "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold border-emerald-200 bg-emerald-50 text-emerald-700" : "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold border-silver-200 bg-silver-50 text-muted"}>
                      {r.active ? "Active" : "Hidden"}
                    </span>
                  </button>
                );
              },
            },
            {
              key: "x",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => {
                      setEditing(r);
                      setName(r.studentName);
                      setCourse(r.course);
                      setAchievement(r.achievement);
                      setModal(true);
                    }}
                    aria-label={`Edit ${r.studentName}`}
                    className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(r)}
                    aria-label={`Delete ${r.studentName}`}
                    className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50"
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
      <AdminModal open={modal} title={editing ? "Edit Testimonial" : "Add Testimonial"} onClose={() => { setModal(false); setEditing(null); }}>
        <label className="block text-[12px] font-bold text-navy-700">
          Student name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="e.g. Ayan Khan" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Course
          <input value={course} onChange={(e) => setCourse(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="JEE Main + Advanced" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Achievement
          <input value={achievement} onChange={(e) => setAchievement(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="AIR 42 — JEE Advanced 2026" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setModal(false); setEditing(null); }}>
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