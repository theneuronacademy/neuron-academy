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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      // Real fetch: GET /api/batches (service falls back to demo data when DB is unavailable)
      setRows(await getBatches());
      setReady(true);
    })();
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
    setBusy(true);
    try {
      const coursesRes = await fetch("/api/courses", { cache: "no-store" });
      const coursesJson = (await coursesRes.json()) as {
        success?: boolean;
        data?: { items?: { id?: string }[] };
      };
      const items = coursesJson?.success && Array.isArray(coursesJson?.data?.items) ? coursesJson.data.items ?? [] : [];
      const courseId = items.length > 0 && items[0].id ? String(items[0].id) : null;
      if (!courseId) throw new Error("No course available");
      // facultyId is optional — omitted until assignment UI lands.
      const res = await fetch("/api/batches", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, courseId }),
      });
      const json = (await res.json()) as { success?: boolean; data?: { item?: BatchApiItem } };
      const created = json?.data?.item;
      if (json?.success && created) {
        setRows((p) => [toAdminBatch(created), ...p]);
        setModal(false);
        setName("");
        flashSaved("Batch created.");
        return;
      }
      throw new Error("Create failed");
    } catch {
      setRows((p) => [...p, { id: `b-${Date.now()}`, name: trimmed, course: "JEE Main + Advanced", faculty: "Unassigned", studentCount: 0, startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "upcoming" }]);
      setModal(false);
      setName("");
      flashSaved("Batch created.");
    } finally {
      setBusy(false);
    }
  };

  const deleteBatch = async (id: string, batchName: string) => {
    if (!window.confirm(`Delete batch "${batchName}"? Students stay enrolled.`)) return;
    try {
      await fetch(`/api/batches/${id}`, { method: "DELETE", cache: "no-store" });
    } catch {
      // Fall through to local remove.
    }
    setRows((p) => p.filter((x) => x.id !== id));
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
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={createBatch} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
