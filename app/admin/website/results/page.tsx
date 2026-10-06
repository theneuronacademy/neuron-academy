"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { RESULTS } from "@/data/results";

interface Row {
  id: string;
  name: string;
  score: string;
  exam: string;
  year: string;
  active: boolean;
}

export default function WebResultsPage() {
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
    // TODO backend: GET /api/admin/website/results
    setRows(RESULTS.map((r) => ({ id: r.id, name: r.name, score: r.score, exam: r.exam, year: r.year, active: true })));
    setReady(true);
  }, [router]);

  const filtered = useMemo(() => rows.filter((r) => !search.trim() || `${r.name} ${r.exam}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  if (!ready) {
    return (
      <AdminLayout title="Web Results" subtitle="Website → Results">
        <LoadingState message="Loading results…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Web Results" subtitle="Selections showcased on the homepage">
      <AdminPageHeader title="Website Results" description="Demo selections — replace with verified academy results." actionLabel="Add Result" actionIcon={Plus} onAction={() => { setName(""); setModal(true); }} />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search results…" />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No results" desc="Publish the first verified selection." />
      ) : (
        <AdminTable<Row>
          columns={[
            { key: "n", header: "Name", render: (r) => <span className="font-extrabold text-navy-700">{r.name}</span> },
            { key: "s", header: "Score", render: (r) => r.score },
            { key: "e", header: "Exam", render: (r) => r.exam },
            { key: "y", header: "Year", render: (r) => r.year },
            {
              key: "x",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)))}>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${r.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-silver-200 bg-silver-50 text-muted"}`}>
                      {r.active ? "Active" : "Hidden"}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete result "${r.name}"?`)) setRows((p) => p.filter((x) => x.id !== r.id));
                    }}
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
      <AdminModal open={modal} title="Add Result" onClose={() => setModal(false)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Topper name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="e.g. Ayan Khan — 99.2 %ile" />
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
              setRows((p) => [...p, { id: `r-${Date.now()}`, name: name.trim(), score: "—", exam: "JEE Main", year: "2026", active: true }]);
              setModal(false);
              setSaved("Result added (demo).");
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
