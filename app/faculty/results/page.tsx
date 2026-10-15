"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";

interface ResultRow { id: string; testId: string; testTitle: string; studentId: string; studentName: string; marks: number; totalMarks: number; percentage: number; date: string }

export default function FacultyResultsPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<ResultRow[]>([]);
  // Deep-link (?testId=) is read client-side only so prerender stays static-safe.
  const [testId, setTestId] = React.useState("");
  const [ready, setReady] = React.useState(false);
  // Item analysis (per-question correct %) for the filtered test.
  const [analysis, setAnalysis] = React.useState<{
    attempts: number;
    hardest: { order: number; questionText: string; correctPct: number | null } | null;
    items: { order: number; questionText: string; subject: string | null; evaluable: boolean; correct: number; wrong: number; unattempted: number; total: number; correctPct: number | null }[];
  } | null>(null);

  async function load(nextTest = testId) {
    const q = nextTest ? `?testId=${encodeURIComponent(nextTest)}` : "";
    const r = await fetch(`/api/results${q}`, { cache: "no-store" });
    if (r.status === 401) { router.replace("/faculty/login"); return; }
    const j = await r.json().catch(() => null);
    if (r.ok && j?.success && Array.isArray(j.data?.items)) setRows(j.data.items);
    setReady(true);
    // Item analysis only makes sense for a single test.
    if (nextTest) {
      try {
        const aR = await fetch(`/api/faculty/tests/${encodeURIComponent(nextTest)}/analysis`, { cache: "no-store" });
        const aJ = await aR.json().catch(() => null);
        if (aR.ok && aJ?.success) setAnalysis(aJ.data);
        else setAnalysis(null);
      } catch {
        setAnalysis(null);
      }
    } else setAnalysis(null);
  }

  useEffect(() => {
    let live = true;
    (async () => {
      let qt = "";
      try {
        qt = new URLSearchParams(window.location.search).get("testId") ?? "";
      } catch {
        /* ignore */
      }
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      if (live) {
        if (qt) setTestId(qt);
        await load(qt);
      }
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
      {summary ? (
        <div className="mt-3 rounded-card border border-silver-200 bg-white p-4 shadow-card">
          <p className="text-[13px] font-extrabold text-navy-700">Score distribution</p>
          <div className="mt-2 flex h-20 items-end gap-1" role="img" aria-label="Score distribution histogram">
            {Array.from({ length: 10 }, (_, b) => {
              const lo = b * 10;
              const c = rows.filter((r) => (r.percentage ?? 0) >= lo && ((r.percentage ?? 0) < lo + 10 || (b === 9 && (r.percentage ?? 0) <= 100))).length;
              const h = rows.length ? Math.max(4, Math.round((c / rows.length) * 72)) : 4;
              return (
                <div key={b} className="flex flex-1 flex-col items-center gap-1" title={`${lo}–${lo + 10}%: ${c} students`}>
                  <div className="w-full rounded-t bg-teal-500" style={{ height: h }} />
                  <span className="text-[9px] font-bold text-muted">{lo}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {analysis && analysis.items.length > 0 ? (
        <div className="mt-3 rounded-card border border-silver-200 bg-white p-4 shadow-card">
          <p className="text-[13px] font-extrabold text-navy-700">Question-wise analysis <span className="font-semibold text-muted">({analysis.attempts} attempts)</span></p>
          {analysis.hardest ? (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-800 ring-1 ring-amber-200">
              Hardest: Q{analysis.hardest.order} — only {analysis.hardest.correctPct}% got it right. Worth revisiting in class.
            </p>
          ) : null}
          <ul className="mt-2 space-y-1.5">
            {analysis.items.map((it) => (
              <li key={it.order} className="rounded-xl bg-silver-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[12px] font-bold text-navy-700">Q{it.order} · {it.evaluable ? it.questionText : `${it.questionText} (subjective — not auto-scored)`}</p>
                  <p className="shrink-0 text-[12px] font-extrabold text-navy-700">{it.evaluable && it.correctPct !== null ? `${it.correctPct}% ✓` : "—"}</p>
                </div>
                {it.evaluable && it.total > 0 ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-silver-200">
                    <div className="h-full rounded-full bg-teal-500" style={{ width: `${it.correctPct ?? 0}%` }} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
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
