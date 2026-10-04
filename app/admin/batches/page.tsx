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
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      // TODO backend: GET /api/admin/batches
      setRows(await getBatches());
      setReady(true);
    })();
  }, [router]);

  const filtered = useMemo(
    () => rows.filter((r) => (status === "all" || r.status === status) && (!search.trim() || `${r.name} ${r.course} ${r.faculty}`.toLowerCase().includes(search.toLowerCase()))),
    [rows, search, status]
  );

  if (!ready) {
    return (
      <AdminLayout title="Batches" subtitle="People → Batches">
        <LoadingState message="Loading batches…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Batches" subtitle="Batch lifecycle and faculty assignment">
      <AdminPageHeader title="Batch Management" description={`${filtered.length} batches • capacity, schedule and mentors.`} actionLabel="Create Batch" actionIcon={Plus} onAction={() => { setName(""); setModal(true); }} />
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
                  <button aria-label={`View ${r.name}`} onClick={() => router.push(`/admin/students`)} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button aria-label={`Edit ${r.name}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete batch "${r.name}"? Students stay enrolled.`)) setRows((p) => p.filter((x) => x.id !== r.id));
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
      <AdminModal open={modal} title="Create Batch" onClose={() => setModal(false)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Batch name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. JEE 2028-A" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
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
              setRows((p) => [...p, { id: `b-${Date.now()}`, name: name.trim(), course: "JEE Main + Advanced", faculty: "Unassigned", studentCount: 0, startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "upcoming" }]);
              setModal(false);
              setSaved("Batch created (demo).");
              window.setTimeout(() => setSaved(null), 2500);
            }}
          >
            Create (demo)
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
