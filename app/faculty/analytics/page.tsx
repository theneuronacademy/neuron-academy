"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";

interface Row { id: string; name: string; batch: string; attendancePct: number | null; testsTaken: number; avgScore: number | null }

export default function FacultyAnalyticsPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [overall, setOverall] = React.useState<{ students: number; attendancePct: number | null; avgScore: number | null; testsTaken: number } | null>(null);
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      const r = await fetch("/api/faculty/analytics", { cache: "no-store" });
      if (r.status === 401) { router.replace("/faculty/login"); return; }
      const j = await r.json().catch(() => null);
      if (live && r.ok && j?.success) {
        if (Array.isArray(j.data?.rows)) setRows(j.data.rows);
        if (j.data?.overall) setOverall(j.data.overall);
      }
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, [router]);

  const weak = React.useMemo(() => rows.filter((r) => (r.attendancePct != null && r.attendancePct < 75) || (r.avgScore != null && r.avgScore < 40)).slice(0, 10), [rows]);

  return (
    <FacultyShell title="Analytics" subtitle="Performance across your assigned batches (server data only)">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Students", overall?.students ?? rows.length], ["Attendance", overall?.attendancePct == null ? "—" : `${overall.attendancePct}%`], ["Avg Score", overall?.avgScore == null ? "—" : `${overall.avgScore}%`], ["Evaluations", overall?.testsTaken ?? 0]].map(([l, v]) => (
          <div key={String(l)} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold tracking-widest text-muted">{l}</p>
            <p className="mt-1 text-2xl font-extrabold text-navy-700">{v}</p>
          </div>
        ))}
      </div>
      {!ready ? (
        <p className="mt-3 rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading analytics</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No student data in your batches yet.</p>
      ) : (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
            <p className="text-[15px] font-extrabold text-navy-700">Needs Attention</p>
            {weak.length === 0 ? <p className="mt-2 text-sm text-muted">No at-risk students by current thresholds (attendance {"<"} 75% or avg {"<"} 40%).</p> : (
              <ul className="mt-3 space-y-2">
                {weak.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-silver-200 px-3.5 py-2.5">
                    <div className="min-w-0"><p className="truncate text-sm font-extrabold text-navy-700">{r.name}</p><p className="text-[12px] text-muted">{r.batch}</p></div>
                    <p className="shrink-0 text-[12px] font-bold text-muted">Att {r.attendancePct == null ? "—" : `${r.attendancePct}%`} | Avg {r.avgScore == null ? "—" : `${r.avgScore}%`}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="overflow-x-auto rounded-card border border-silver-200 bg-white shadow-card">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead><tr className="border-b border-silver-100 text-[11px] text-muted"><th className="p-3">Student</th><th className="p-3">Att</th><th className="p-3">Tests</th><th className="p-3">Avg</th></tr></thead>
              <tbody>
                {rows.slice(0, 50).map((r) => (
                  <tr key={r.id} className="border-b border-silver-100 last:border-0">
                    <td className="p-3"><p className="font-extrabold text-navy-700">{r.name}</p><p className="text-[12px] text-muted">{r.batch}</p></td>
                    <td className="p-3">{r.attendancePct == null ? "—" : `${r.attendancePct}%`}</td>
                    <td className="p-3">{r.testsTaken}</td>
                    <td className="p-3 font-bold">{r.avgScore == null ? "—" : `${r.avgScore}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FacultyShell>
  );
}
