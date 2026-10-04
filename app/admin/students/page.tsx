"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { AdminModal, AdminDrawer } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { ProgressBar } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getStudents } from "@/services/adminApi";
import type { AdminStudent } from "@/data/admin";

export default function StudentsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminStudent[]>([]);
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("all");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [view, setView] = useState<AdminStudent | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      // TODO backend: GET /api/admin/students
      setRows(await getStudents());
      setReady(true);
    })();
  }, [router]);

  const batches = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => r.batch)))], [rows]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (batch === "all" || r.batch === batch) &&
          (status === "all" || r.status === status) &&
          (!search.trim() || `${r.name} ${r.studentId} ${r.email} ${r.phone}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [rows, search, batch, status]
  );

  if (!ready) {
    return (
      <AdminLayout title="Students" subtitle="People → Students">
        <LoadingState message="Loading students…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Students" subtitle={`${filtered.length} of ${rows.length} learners`}>
      <AdminPageHeader title="Student Management" description="Search, filter, enroll and track every learner." actionLabel="Add Student" actionIcon={Plus} onAction={() => { setName(""); setModal(true); }} />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, ID, email, phone…" />
        <FilterBar value={batch} onChange={setBatch} ariaLabel="Filter by batch" options={batches.map((b) => ({ value: b, label: b === "all" ? "All batches" : b }))} />
        <FilterBar value={status} onChange={setStatus} ariaLabel="Filter by status" options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No students found" desc="Try a different search or enroll the first student." />
      ) : (
        <AdminTable<AdminStudent>
          columns={[
            {
              key: "s",
              header: "Student",
              render: (r) => (
                <div>
                  <p className="font-extrabold text-navy-700">{r.name}</p>
                  <p className="text-[12px] text-muted">{r.studentId} • {r.batch}</p>
                </div>
              ),
            },
            { key: "c", header: "Contact", render: (r) => <span className="text-[13px] text-muted">{r.phone}<br />{r.email}</span> },
            {
              key: "a",
              header: "Attendance",
              render: (r) => (
                <span className="block w-28">
                  <span className="text-[12px] font-bold text-navy-700">{r.attendancePct}%</span>
                  <ProgressBar value={r.attendancePct} className="mt-1" tone={r.attendancePct >= 85 ? "teal" : r.attendancePct >= 70 ? "navy" : "red"} />
                </span>
              ),
            },
            { key: "p", header: "Avg Score", render: (r) => <span className="font-extrabold text-navy-700">{r.avgScore}%</span> },
            { key: "st", header: "Status", render: (r) => <AdminStatusBadge tone={statusToneFor(r.status)}>{r.status === "active" ? "Active" : "Inactive"}</AdminStatusBadge> },
            {
              key: "x",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => setView(r)} aria-label={`View ${r.name}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, status: x.status === "active" ? "inactive" : "active" } : x)))}
                    aria-label={`Toggle ${r.name}`}
                    className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete student "${r.name}"? This cannot be undone.`)) setRows((p) => p.filter((x) => x.id !== r.id));
                    }}
                    aria-label={`Delete ${r.name}`}
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

      <AdminModal open={modal} title="Add Student" onClose={() => setModal(false)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ayan Khan" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </label>
        <p className="mt-2 text-[12px] text-muted">Email, phone, batch and course fields arrive with the backend enrollment form.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (!name.trim()) return;
              setRows((p) => [...p, { id: `s-${Date.now()}`, studentId: `NA-2026-${String(p.length + 1).padStart(3, "0")}`, name: name.trim(), email: "new@student.in", phone: "+91 97119 17317", batch: "JEE 2027-A", course: "JEE Main + Advanced", joiningDate: new Date().toISOString().slice(0, 10), attendancePct: 0, avgScore: 0, status: "active" }]);
              setModal(false);
              setSaved("Student enrolled (demo — backend sync later).");
              window.setTimeout(() => setSaved(null), 2500);
            }}
          >
            Enroll (demo)
          </Button>
        </div>
      </AdminModal>

      <AdminDrawer open={view !== null} title={view ? view.name : "Student"} onClose={() => setView(null)}>
        {view ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-navy-800 p-4 text-white">
              <p className="text-[11px] font-bold tracking-widest text-teal-200">{view.studentId}</p>
              <p className="mt-1 text-lg font-extrabold">{view.name}</p>
              <p className="text-[13px] text-silver-200">{view.course} • {view.batch}</p>
              <p className="mt-1 text-[12px] text-silver-300">Joined {view.joiningDate}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-xl bg-silver-50 p-3"><p className="text-[11px] font-bold text-muted">PHONE</p><p className="font-bold text-navy-700">{view.phone}</p></div>
              <div className="rounded-xl bg-silver-50 p-3"><p className="text-[11px] font-bold text-muted">EMAIL</p><p className="truncate font-bold text-navy-700">{view.email}</p></div>
              <div className="rounded-xl bg-silver-50 p-3"><p className="text-[11px] font-bold text-muted">ATTENDANCE</p><p className="font-extrabold text-navy-700">{view.attendancePct}%</p><ProgressBar value={view.attendancePct} className="mt-1.5" /></div>
              <div className="rounded-xl bg-silver-50 p-3"><p className="text-[11px] font-bold text-muted">AVG SCORE</p><p className="font-extrabold text-navy-700">{view.avgScore}%</p><ProgressBar value={view.avgScore} className="mt-1.5" tone="navy" /></div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-silver-200 px-3.5 py-2.5">
              <span className="text-[13px] font-bold text-navy-700">Status</span>
              <AdminStatusBadge tone={statusToneFor(view.status)}>{view.status}</AdminStatusBadge>
            </div>
            <p className="text-[12px] text-muted">Full mark history, batch transfer and fee ledger arrive with the backend profile API.</p>
          </div>
        ) : null}
      </AdminDrawer>
    </AdminLayout>
  );
}
