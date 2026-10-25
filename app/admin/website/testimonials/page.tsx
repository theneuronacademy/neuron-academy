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
import { CloudinaryUpload } from "@/components/admin/CloudinaryUpload";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface Row {
  id: string;
  studentName: string;
  course: string;
  message: string;
  achievement: string;
  photo: string;
  active: boolean;
}

export default function TestimonialsAdminPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [achievement, setAchievement] = useState("");
  const [message, setMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  // Phase 17 — persistence errors surface honestly (no local writes).
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/testimonials", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          // Database rows use the API contract fields (name/role/message/
          // achievement/photo); the demo fallback uses the course/course label.
          setRows((json.data.items as Array<{ id: string; studentName?: string; name?: string; course?: string; role?: string; message?: string; achievement?: string; photo?: string; isActive?: boolean }>).map((t) => ({
            id: t.id,
            studentName: t.studentName ?? t.name ?? "",
            course: t.course ?? t.role ?? "",
            message: t.message ?? "",
            achievement: t.achievement ?? "",
            photo: t.photo ?? "",
            active: t.isActive ?? true,
          })));
        } else {
          const { TESTIMONIALS } = await import("@/data/testimonials");
          setRows(TESTIMONIALS.map((t) => ({ id: t.id, studentName: t.studentName, course: t.course, message: t.testimonial, achievement: t.achievement, photo: t.photo, active: true })));
        }
      } catch {
        const { TESTIMONIALS } = await import("@/data/testimonials");
        setRows(TESTIMONIALS.map((t) => ({ id: t.id, studentName: t.studentName, course: t.course, message: t.testimonial, achievement: t.achievement, photo: t.photo, active: true })));
      }
      setReady(true);
    })();
  }, [router, authReady, isAdmin]);

  const filtered = useMemo(() => rows.filter((r) => !search.trim() || `${r.studentName} ${r.course}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  // The UI fields map onto the API contract exactly:
  //   Student name  -> name        (required)
  //   Course        -> role
  //   Achievement   -> achievement (optional display line)
  //   Testimonial   -> message     (required — the quote itself)
  //   Student photo -> photo
  const save = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Student name is required.");
      return;
    }
    if (!message.trim()) {
      setFormError("The testimonial quote is required.");
      return;
    }
    const payload = { name: name.trim(), role: course.trim(), achievement: achievement.trim(), message: message.trim(), photo: photoUrl || undefined, isActive: true };
    try {
      if (editing) {
        const res = await fetch(`/api/testimonials/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success !== false) {
          setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, studentName: name.trim(), course: course.trim(), message: message.trim(), achievement: achievement.trim(), photo: photoUrl } : r)));
          setSaved("Testimonial updated.");
          setModal(false);
          setEditing(null);
        } else {
          setFormError(json?.error ?? "Could not update testimonial. Nothing was saved.");
          return;
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
          setRows((p) => [...p, { id: item.id, studentName: String(item.name ?? item.studentName ?? ""), course: String(item.course ?? item.role ?? ""), message: String(item.message ?? ""), achievement: String(item.achievement ?? ""), photo: String(item.photo ?? ""), active: true }]);
          setSaved("Testimonial added.");
          setModal(false);
        } else {
          setFormError(json?.error ?? "Could not add testimonial. Nothing was saved.");
          return;
        }
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
      return;
    }
    setEditing(null);
    setName("");
    setCourse("");
    setAchievement("");
    setMessage("");
    setPhotoUrl("");
    window.setTimeout(() => setSaved(null), 2500);
  };

  // Phase 17 — visibility toggle persists immediately.
  const toggleActive = async (r: Row) => {
    setPageError(null);
    const next = !r.active;
    try {
      const res = await fetch(`/api/testimonials/${r.id}`, {
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

  const remove = async (r: Row) => {
    if (!window.confirm(`Delete testimonial from "${r.studentName}"?`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/testimonials/${r.id}`, { method: "DELETE", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Testimonial deleted.");
      } else {
        setPageError(json?.error ?? "Could not delete testimonial. Nothing was deleted.");
      }
    } catch {
      setPageError("Cannot reach the server. Nothing was deleted.");
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
      <AdminPageHeader title="Testimonials" description="Quotes shown on the homepage carousel." actionLabel="Add Testimonial" actionIcon={Plus} onAction={() => { setEditing(null); setName(""); setCourse(""); setAchievement(""); setMessage(""); setPhotoUrl(""); setFormError(null); setModal(true); }} />
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
                <button onClick={() => void toggleActive(r)} aria-label={`Toggle visibility of ${r.studentName}`} aria-pressed={r.active}>
                  <span className={r.active ? "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold border-emerald-200 bg-emerald-50 text-emerald-700" : "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold border-silver-200 bg-silver-50 text-muted"}>
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
                  <button
                    onClick={() => {
                      setEditing(r);
                      setName(r.studentName);
                      setCourse(r.course);
                      setAchievement(r.achievement);
                      setMessage(r.message);
                      setPhotoUrl(r.photo);
                      setFormError(null);
                      setModal(true);
                    }}
                    aria-label={`Edit ${r.studentName}`}
                    title="Edit"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-silver-300 text-navy-700 hover:border-teal-500 sm:h-8 sm:w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => void remove(r)} aria-label={`Delete ${r.studentName}`} title="Delete" className="flex h-10 w-10 items-center justify-center rounded-lg border border-crimson-100 text-crimson hover:bg-crimson-50 sm:h-8 sm:w-8">
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
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" placeholder="e.g. Ayan Khan" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Course
          <input value={course} onChange={(e) => setCourse(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" placeholder="JEE Main + Advanced" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Achievement
          <input value={achievement} onChange={(e) => setAchievement(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" placeholder="AIR 42 — JEE Advanced 2026" maxLength={80} />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Testimonial (the quote shown publicly — required)
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Share the student’s experience in their own words…"
            className="mt-1.5 w-full resize-y rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm"
          />
        </label>
        <CloudinaryUpload
          category="gallery"
          accept="image/jpeg,image/png,image/webp,image/avif"
          resourceType="image"
          label="Student photo"
          buttonLabel={photoUrl ? "Replace photo" : "Upload photo"}
          onUploadComplete={(url) => setPhotoUrl(url)}
        />
        {formError ? (
          <p className="mt-3 rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson" role="alert">{formError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setModal(false); setEditing(null); }}>
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