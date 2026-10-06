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
  const [score, setScore] = useState("");
  const [exam, setExam] = useState("JEE Main");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/results/offline", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows(json.data.items.map((r: any) => ({
            id: r.id,
            name: r.name ?? r.studentName ?? "",
            score: r.score ?? r.marks ?? "",
            exam: r.exam ?? r.testTitle ?? "",
            year: r.year ?? new Date(r.createdAt).getFullYear().toString(),
            active: r.isActive ?? true,
          })));
        } else {
          const { RESULTS } = await import("@/data/results");
          setRows(RESULTS.map((r) => ({ id: r.id, name: r.name, score: r.score, exam: r.exam, year: r.year, active: true })));
        }
      } catch {
        const { RESULTS } = await import("@/data/results");
        setRows(RESULTS.map((r) => ({ id: r.id, name: r.name, score: r.score, exam: r.exam, year: r.year, active: true })));
      }
      setReady(true);
    })();
  }, [router]);

  const filtered = useMemo(() => rows.filter((r) => !search.trim() || `${r.name} ${r.exam}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const save = async () => {
    if (!name.trim()) return;
    const payload = { name: name.trim(), score: score.trim(), exam: exam.trim(), year: year.trim(), isActive: true };
    try {
      const res = await fetch("/api/results/offline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json.data?.item) {
        const item = json.data.item;
        setRows((p) => [...p, { id: item.id, name: item.name, score: item.score, exam: item.exam, year: item.year, active: true }]);
        setSaved("Result added.");
      } else {
        setRows((p) => [...p, { id: `r-${Date.now()}`, name: name.trim(), score: score.trim(), exam: exam.trim(), year: year.trim(), active: true }]);
        setSaved("Result added locally (database unavailable).");
      }
    } catch {
      setRows((p) => [...p, { id: `r-${Date.now()}`, name: name.trim(), score: score.trim(), exam: exam.trim(), year: year.trim(), active: true }]);
      setSaved("Saved locally (database unavailable).");
    }
    setModal(false);
    setName("");
    setScore("");
    window.setTimeout(() => setSaved(null), 2500);
  };

  const remove = async (r: Row) => {
    if (!window.confirm(`Delete result "${r.name}"?`)) return;
    try {
      const res = await fetch(`/api/results/offline/${r.id}`, { method: "DELETE", cache: "no-store" });
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Result deleted.");
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
      <AdminLayout title="Web Results" subtitle="Website → Results">
        <LoadingState message="Loading results…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Web Results" subtitle="Selections showcased on the homepage">
      <AdminPageHeader title="Website Results" description="Verified academy results for the homepage." actionLabel="Add Result" actionIcon={Plus} onAction={() => { setName(""); setScore(""); setModal(true); }} />
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
                  <button
                    onClick={() => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)))}
                    className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"
                  >
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${r.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-silver-200 bg-silver-50 text-muted"}`}>
                      {r.active ? "Active" : "Hidden"}
                    </span>
                  </button>
                  <button
                    onClick={() => remove(r)}
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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] font-bold text-navy-700">
            Topper name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="e.g. Ayan Khan — 99.2 %ile" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Score / Percentile
            <input value={score} onChange={(e) => setScore(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="99.2 %ile" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Exam
            <select value={exam} onChange={(e) => setExam(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500">
              <option value="JEE Main">JEE Main</option>
              <option value="JEE Advanced">JEE Advanced</option>
              <option value="NEET">NEET</option>
              <option value="AMU">AMU</option>
              <option value="JMI">Jamia Millia Islamia</option>
            </select>
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Year
            <input value={year} onChange={(e) => setYear(e.target.value)} type="number" min={2020} max={2030} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
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