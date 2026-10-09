"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getBatches } from "@/services/adminApi";
import type { AdminBatch } from "@/data/admin";

export default function BatchesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminBatch[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  // Phase 17 — explicit course/faculty selection + honest errors.
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [facultyList, setFacultyList] = useState<{ id: string; name: string }[]>([]);
  const [courseId, setCourseId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminBatch | null>(null);
  const [editFaculty, setEditFaculty] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      // Real fetch: GET /api/batches (service falls back to demo data when DB is unavailable)
      setRows(await getBatches());
      try {
        const [cRes, fRes] = await Promise.all([
          fetch("/api/courses", { cache: "no-store" }),
          fetch("/api/faculty", { cache: "no-store" }),
        ]);
        // Phase 17 — handle both API response shapes (adminApi returns {items}, courses API returns {data:{items}})
        const cJson = (await cRes.json().catch(() => null)) as { success?: boolean; data?: { items?: { id?: string; name?: string }[] }; items?: { id?: string; name?: string }[] } | null;
        const rawItems = cJson?.items ?? cJson?.data?.items;
        if (cRes.ok && Array.isArray(rawItems)) {
          const list = rawItems.filter((c) => c?.id).map((c) => ({ id: String(c.id), name: String(c.name ?? "Course") }));
          setCourses(list);
          if (!courseId && list.length > 0) setCourseId(list[0].id);
        }
        const fJson = (await fRes.json().catch(() => null)) as { success?: boolean; data?: { items?: { id?: string; name?: string; facultyId?: string; facultyName?: string }[] } } | null;
        if (fRes.ok && Array.isArray(fJson?.data?.items)) {
          setFacultyList(
            (fJson.data?.items ?? []).filter((f) => f?.id).map((f) => ({ id: String(f.id), name: String(f.name ?? "Faculty") }))
          );
        }
      } catch {
        /* selects stay empty — creation reports honestly */
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const filtered = useMemo(
    () => rows.filter((r) => (status === "all" || r.status === status) && (!search.trim() || `${r.name} ${r.course} ${r.faculty}`.toLowerCase().includes(search.toLowerCase()))),
    [rows, search, status]
  );

  interface BatchApiItem {
    id: string;
    name: string;
    course: string;
    faculty: string;
    studentCount: number;
    startDate: string;
    endDate: string;
    status: string;
  }

  function toAdminBatch(item: BatchApiItem): AdminBatch {
    return {
      id: String(item.id),
      name: String(item.name),
      course: String(item.course ?? "—"),
      faculty: String(item.faculty ?? "Unassigned"),
      studentCount: typeof item.studentCount === "number" ? item.studentCount : 0,
      startDate: String(item.startDate ?? ""),
      endDate: String(item.endDate ?? ""),
      status: item.status === "active" ? "active" : item.status === "completed" ? "completed" : "upcoming",
    };
  }

  const flashSaved = (msg: string) => {
    setSaved(msg);
    window.setTimeout(() => setSaved(null), 2500);
  };

  const createBatch = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setFormError(null);
    if (!courseId) {
      setFormError("Select a course first. Create a course before creating batches.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, courseId, ...(facultyId ? { facultyId } : {}) }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { item?: BatchApiItem }; error?: string } | null;
      const created = json?.data?.item;
      if (res.ok && json?.success && created) {
        setRows((p) => [toAdminBatch(created), ...p]);
        setModal(false);
        setName("");
        setFacultyId("");
        flashSaved("Batch created.");
      } else {
        setFormError(json?.error ?? "Could not create batch.");
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (row: AdminBatch) => {
    const match = facultyList.find((f) => f.name === row.faculty);
    setEditing(row);
    setEditFaculty(match ? match.id : "");
    setEditStatus(row.status);
    setFormError(null);
  };

  const saveEdit = async () => {
    if (!editing || busy) return;
    setFormError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/batches/${editing.id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facultyId: editFaculty || null,
          ...(editStatus === "active" || editStatus === "upcoming" || editStatus === "completed"
            ? { status: editStatus.toUpperCase() }
            : {}),
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (res.ok && json?.success !== false) {
        const facultyName = editFaculty ? (facultyList.find((f) => f.id === editFaculty)?.name ?? "Unassigned") : "Unassigned";
        setRows((p) => p.map((x) => (x.id === editing.id ? { ...x, faculty: facultyName, status: editStatus as AdminBatch["status"] } : x)));
        setEditing(null);
        flashSaved("Batch updated.");
      } else {
        setFormError(json?.error ?? "Could not update batch.");
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  const deleteBatch = async (id: string, batchName: string) => {
    if (!window.confirm(`Delete batch "${batchName}"? Batches with students, tests or attendance cannot be deleted — mark them COMPLETED instead.`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/batches/${id}`, { method: "DELETE", cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (res.ok && json?.success !== false) {
        setRows((p) => p.filter((x) => x.id !== id));
        flashSaved("Batch deleted.");
        return;
      }
      // Phase 17 — 409 dependency guard message reaches the admin verbatim.
      setPageError(json?.error ?? "Could not delete batch.");
    } catch {
      setPageError("Cannot reach the server. Nothing was deleted.");
    }
  };

  if (!ready) {
    return (
      <AdminLayout title="Batches" subtitle="People → Batches">
        <LoadingState message="Loading batches…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Batches" subtitle="Batch lifecycle and faculty assignment">
      <AdminPageHeader title="Batch Management" description={`${filtered.length} batches • capacity, schedule and mentors.`} actionLabel="Create Batch" actionIcon={Plus} onAction={() => { setName(""); setFacultyId(""); setFormError(null); setModal(true); }} />
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
        <SearchBar value={search} onChange={setSearch} placeholder="Search batches…" />
        <FilterBar value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "upcoming", label: "Upcoming" }, { value: "completed", label: "Completed" }]} />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No batches" desc="Create the first batch for the new session." />
      ) : (
        <AdminTable<AdminBatch>
          columns={[
            { key: "b", header: "Batch", render: (r) => <span><span className="block font-extrabold text-navy-700">{r.name}</span><span className="block text-[12px] text-muted">{r.course}</span></span> },
            { key: "f", header: "Faculty", render: (r) => r.faculty },
            { key: "c", header: "Students", render: (r) => <span className="font-extrabold text-navy-700">{r.studentCount}</span> },
            { key: "d", header: "Schedule", render: (r) => <span className="text-[12px] text-muted">{r.startDate} → {r.endDate}</span> },
            { key: "s", header: "Status", render: (r) => <AdminStatusBadge tone={statusToneFor(r.status)}>{r.status}</AdminStatusBadge> },
            {
              key: "x",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button aria-label={`View ${r.name}`} onClick={() => router.push(`/admin/students?batch=${encodeURIComponent(r.name)}`)} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button aria-label={`Edit ${r.name}`} onClick={() => openEdit(r)} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteBatch(r.id, r.name)}
                    aria-label={`Delete ${r.name}`}
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
      <AdminModal open={modal} title="Create Batch" onClose={() => setModal(false)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Batch name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. JEE 2028-A" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Course
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500">
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Faculty (optional)
          <select value={facultyId} onChange={(e) => setFacultyId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500">
            <option value="">Unassigned</option>
            {facultyList.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
        {formError && !editing ? (
          <p className="mt-3 rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson" role="alert">{formError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={createBatch} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </AdminModal>
      <AdminModal open={editing !== null} title={editing ? `Edit ${editing.name}` : "Edit batch"} onClose={() => setEditing(null)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Faculty
          <select value={editFaculty} onChange={(e) => setEditFaculty(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500">
            <option value="">Unassigned</option>
            {facultyList.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Status
          <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500">
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        {formError && editing ? (
          <p className="mt-3 rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson" role="alert">{formError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={saveEdit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
