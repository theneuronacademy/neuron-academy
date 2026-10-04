"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, Trash2, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { AdminModal, AdminDrawer } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getFaculty } from "@/services/adminApi";
import type { AdminFaculty } from "@/data/admin";

export default function FacultyAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminFaculty[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [view, setView] = useState<AdminFaculty | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      // TODO backend: GET /api/admin/faculty
      setRows(await getFaculty());
      setReady(true);
    })();
  }, [router]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => (status === "all" || r.status === status) && (!search.trim() || `${r.name} ${r.subject} ${r.email}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [rows, search, status]
  );

  if (!ready) {
    return (
      <AdminLayout title="Faculty" subtitle="People → Faculty">
        <LoadingState message="Loading faculty…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Faculty" subtitle="Mentors, subjects and batch assignments">
      <AdminPageHeader title="Faculty Management" description={`${filtered.length} faculty • assign batches and subjects.`} actionLabel="Add Faculty" actionIcon={Plus} onAction={() => { setName(""); setModal(true); }} />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search faculty…" />
        <FilterBar value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No faculty found" desc="Onboard the first mentor." />
      ) : (
        <AdminTable<AdminFaculty>
          columns={[
            {
              key: "f",
              header: "Faculty",
              render: (r) => (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-700 text-[13px] font-extrabold text-white">{r.name.charAt(0)}</span>
                  <span>
                    <span className="block font-extrabold text-navy-700">{r.name}</span>
                    <span className="block text-[12px] text-muted">{r.subject} • {r.experience}</span>
                  </span>
                </div>
              ),
            },
            { key: "q", header: "Qualification", render: (r) => <span className="text-muted">{r.qualification}</span> },
            { key: "b", header: "Batches", render: (r) => <span className="text-[13px] font-semibold text-navy-700">{r.batches.join(", ")}</span> },
            { key: "s", header: "Status", render: (r) => <AdminStatusBadge tone={statusToneFor(r.status)}>{r.status}</AdminStatusBadge> },
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
                    className="rounded-lg border border-silver-300 px-2.5 py-2 text-[12px] font-bold text-navy-700 hover:border-teal-500"
                  >
                    {r.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Remove faculty "${r.name}"?`)) setRows((p) => p.filter((x) => x.id !== r.id));
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
      <AdminModal open={modal} title="Add Faculty" onClose={() => setModal(false)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. S. Rao" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
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
              setRows((p) => [...p, { id: `f-${Date.now()}`, name: name.trim(), photo: "", email: "new@neuronacademy.in", phone: "+91 97119 17317", subject: "Physics", qualification: "—", experience: "—", batches: [], status: "active" }]);
              setModal(false);
              setSaved("Faculty onboarded (demo).");
              window.setTimeout(() => setSaved(null), 2500);
            }}
          >
            Save (demo)
          </Button>
        </div>
      </AdminModal>
      <AdminDrawer open={view !== null} title={view ? view.name : "Faculty"} onClose={() => setView(null)}>
        {view ? (
          <div className="space-y-3 text-[13px]">
            <p className="font-bold text-navy-700">{view.subject} • {view.qualification}</p>
            <p className="text-muted">{view.experience} experience</p>
            <p><span className="font-bold text-navy-700">Email:</span> {view.email}</p>
            <p><span className="font-bold text-navy-700">Phone:</span> {view.phone}</p>
            <p><span className="font-bold text-navy-700">Batches:</span> {view.batches.join(", ") || "Unassigned"}</p>
            <p className="text-muted">Batch assignment editor and timetable arrive with the backend API.</p>
          </div>
        ) : null}
      </AdminDrawer>
    </AdminLayout>
  );
}
