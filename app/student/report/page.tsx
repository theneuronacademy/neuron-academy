"use client";

import { useEffect, useState } from "react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { useStudentProfile } from "@/components/student/useStudentProfile";
import { AttendanceHeatmap } from "@/components/analytics/AttendanceHeatmap";

interface Streak { currentStreak: number; longestStreak: number; totalActiveDays: number; testsCompleted: number; presentDays: number; xp: number }
interface AttSummary { total: number; present: number; absent: number; late: number; leave: number; percentage: number | null }
interface AttItem { date: string; status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE" }
interface ResultRow { id: string; testTitle?: string; percentage: number; marks: number; totalMarks: number }

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function StudentReportPage() {
  const session = useStudentGuard();
  const { profile } = useStudentProfile();
  const [streak, setStreak] = useState<Streak | null>(null);
  const [summary, setSummary] = useState<AttSummary | null>(null);
  const [items, setItems] = useState<AttItem[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const [sR, aR, rR] = await Promise.all([
          fetch("/api/students/me/streak", { cache: "no-store" }),
          fetch(`/api/students/me/attendance?month=${month}`, { cache: "no-store" }),
          fetch("/api/results", { cache: "no-store" }),
        ]);
        const sJ = await sR.json().catch(() => null);
        if (sR.ok && sJ?.success) setStreak(sJ.data as Streak);
        const aJ = await aR.json().catch(() => null);
        if (aR.ok && aJ?.success) {
          setSummary(aJ.data.summary as AttSummary);
          setItems((aJ.data.items ?? []) as AttItem[]);
        }
        const rJ = await rR.json().catch(() => null);
        if (rR.ok && rJ?.success && Array.isArray(rJ.data?.items)) {
          setResults((rJ.data.items as ResultRow[]).slice(0, 10));
        }
      } finally {
        setReady(true);
      }
    })();
  }, [session, month]);

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  const avg =
    results.length > 0 ? Math.round((results.reduce((s, r) => s + r.percentage, 0) / results.length) * 10) / 10 : null;

  return (
    <StudentShell title="My Report" subtitle="Share with parents — print-friendly monthly summary">
      <div className="mb-3 flex justify-end print:hidden">
        <button onClick={() => window.print()} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800">
          🖨 Print / Save PDF
        </button>
      </div>
      {!ready ? (
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Building report…</p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
            <p className="text-lg font-extrabold text-navy-700">{profile?.name ?? session.name}</p>
            <p className="text-[13px] text-muted">
              {profile?.studentId ?? ""} · {month} · Generated {new Date().toLocaleDateString()}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["XP", streak ? String(streak.xp) : "—"],
                ["Day Streak", streak ? `${streak.currentStreak} 🔥` : "—"],
                ["Attendance", summary?.percentage == null ? "—" : `${summary.percentage}%`],
                ["Avg Score", avg == null ? "—" : `${avg}%`],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-silver-50 p-3">
                  <p className="text-[11px] font-bold tracking-widest text-muted">{l}</p>
                  <p className="mt-0.5 text-xl font-extrabold text-navy-700">{v}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[15px] font-extrabold text-navy-700">Attendance — {month}</p>
              <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-xl border border-silver-300 px-3 py-1.5 text-sm print:hidden" />
            </div>
            <div className="mt-3 max-w-md">
              <AttendanceHeatmap month={month} days={items.map((r) => ({ date: String(r.date).slice(0, 10), status: r.status }))} />
            </div>
            {summary ? (
              <p className="mt-2 text-[13px] text-muted">
                Present {summary.present} · Absent {summary.absent} · Late {summary.late} · Leave {summary.leave} (all-time)
              </p>
            ) : null}
          </div>

          <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
            <p className="text-[15px] font-extrabold text-navy-700">Recent Results</p>
            {results.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No evaluated results yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {results.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-silver-50 px-3 py-2">
                    <p className="min-w-0 truncate text-[13px] font-bold text-navy-700">{r.testTitle ?? "Test"}</p>
                    <p className="shrink-0 text-[13px] font-extrabold text-navy-700">{r.percentage}% <span className="font-semibold text-muted">({r.marks}/{r.totalMarks})</span></p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </StudentShell>
  );
}
