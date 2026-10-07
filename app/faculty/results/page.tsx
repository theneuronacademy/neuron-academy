"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";

interface ResultRow { id: string; testId: string; testTitle: string; studentId: string; studentName: string; marks: number; totalMarks: number; percentage: number; date: string }

export default function FacultyResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = React.useState<ResultRow[]>([]);
  const [testId, setTestId] = React.useState(searchParams.get("testId") ?? "");
  const [ready, setReady] = React.useState(false);

  async function load(nextTest = testId) {
    const q = nextTest ? `?testId=${encodeURIComponent(nextTest)}` : "";
    const r = await fetch(`/api/results${q}`, { cache: "no-store" });
    if (r.status === 401) { router.replace("/faculty/login"); return; }
    const j = await r.json().catch(() => null);
    if (r.ok && j?.success && Array.isArray(j.data?.items)) setRows(j.data.items);
    setReady(true);
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      if (live) await load();
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const summary = React.useMemo(() => {
    if (rows.length === 0) return null;
    const ps = rows.map((r) => r.percentage ?? 0);
    return {
      count: rows.length,
      avg: Math.round((ps.reduce((a, b) => a + b, 0) / ps.length) * 10) / 10,
      high: Math.max(...ps),
      low: Math.min(...ps),
      submitted: rows.length,
    };
  }, [rows]);

  return (
    <FacultyShell title="Results" subtitle="Server-calculated results for your authorized tests">
      <div className="flex flex-wrap gap-2">
        <input value={testId} onChange={(e) => setTestId(e.target.value)} placeholder="Filter by testId (optional)" className="min-w-[200px] flex-1 rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
        <button onClick={() => void load()} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800">Apply</button>
      </div>
      {summary ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Evaluated", summary.count], ["Average", `${summary.avg}%`], ["Highest", `${summary.high}%`], ["Lowest", `${summary.low}%`]].map(([l, v]) => (
            <div key={String(l)} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <p className="text-[11px] font-bold tracking-widest text-muted">{l}</p>
              <p className="mt-1 text-2xl font-extrabold text-navy-700">{v}</p>
            </div>
          ))}
        </div>
      ) : null}
      {!ready ? (
        <p className="mt-3 rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading results</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No results for your authorized tests yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-card border border-silver-200 bg-white shadow-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-silver-100 text-[11px] text-muted">
                <th className="p-3">Student</th>
                <th className="p-3">Test</th>
                <th className="p-3">Marks</th>
                <th className="p-3">%</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-silver-100 last:border-0">
                  <td className="p-3 font-extrabold text-navy-700">{r.studentName}</td>
                  <td className="p-3">{r.testTitle}</td>
                  <td className="p-3">{r.marks}/{r.totalMarks}</td>
                  <td className="p-3 font-bold">{r.percentage}%</td>
                  <td className="p-3 text-[12px] text-muted">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[12px] text-muted">Scores are server-authoritative. Faculty cannot submit score/percentage from the client for online evaluation.</p>
    </FacultyShell>
  );
}
