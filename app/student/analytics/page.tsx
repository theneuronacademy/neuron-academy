"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { Bars, Ring, Skeleton, TrendChart } from "@/components/student/charts";

interface Analytics {
  tests: {
    attempted: number;
    completed: number;
    inProgress: number;
    averagePercentage: number | null;
    highest: number | null;
    lowest: number | null;
    trend: { title: string; percentage: number; date: string }[];
  };
  attendance: {
    total: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    percentage: number | null;
  };
}

/** Phase 16 — honest analytics (REGULAR only, server-computed, no invented stats). */
export default function StudentAnalyticsPage() {
  const session = useStudentGuard();
  const [data, setData] = useState<Analytics | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!session) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/students/me/analytics", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!live) return;
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        if (res.ok && json?.success === true) setData(json.data as Analytics);
        else setFailed(true);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [session]);

  if (!session)
    return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (forbidden) {
    return (
      <StudentShell title="Analytics" subtitle="Regular students">
        <p className="rounded-card bg-white p-8 text-center text-sm font-bold text-muted">
          Analytics are available for regular students only.
        </p>
      </StudentShell>
    );
  }

  return (
    <StudentShell title="My Analytics" subtitle="Computed from your academy records">
      {data === null && !failed ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : failed || data === null ? (
        <div className="rounded-card border border-amber-300 bg-amber-50 p-6 text-center" role="alert">
          <p className="text-sm font-extrabold text-amber-800">Could not load analytics.</p>
          <p className="mt-1 text-[13px] font-semibold text-amber-700">Check your connection and try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white"
          >
            Retry
          </button>
        </div>
      ) : data.tests.attempted === 0 && data.attendance.total === 0 ? (
        <div className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center">
          <p className="text-sm font-extrabold text-navy-700">Not enough data yet.</p>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            Attempt a test or attend a class and your trend will appear here. No numbers are estimated.
          </p>
          <Link
            href="/student/tests"
            className="mt-4 inline-block rounded-xl bg-crimson px-5 py-2.5 text-sm font-bold text-white"
          >
            Browse tests
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0 rounded-card border border-silver-200 bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-navy-700">
              <BarChart3 className="h-4 w-4" /> Performance
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {[
                { l: "TESTS", v: data.tests.attempted === 0 ? "—" : String(data.tests.attempted) },
                { l: "AVERAGE", v: data.tests.averagePercentage === null ? "—" : `${data.tests.averagePercentage}%` },
                { l: "BEST", v: data.tests.highest === null ? "—" : `${data.tests.highest}%` },
                { l: "LOWEST", v: data.tests.lowest === null ? "—" : `${data.tests.lowest}%` },
              ].map((s) => (
                <div key={s.l} className="min-w-0 rounded-xl bg-silver-50 px-2 py-2.5">
                  <p className="truncate text-lg font-extrabold text-navy-700">{s.v}</p>
                  <p className="text-[10px] font-bold tracking-widest text-muted">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 overflow-x-auto">
              <TrendChart
                points={(data.tests.trend ?? []).map((t) => ({ label: t.title, value: t.percentage }))}
              />
            </div>
            <p className="mt-2 break-words text-[12px] text-muted">
              {data.tests.completed} evaluated • {data.tests.inProgress} in progress
            </p>
          </div>
          <div className="min-w-0 rounded-card border border-silver-200 bg-white p-5 shadow-card">
            <h2 className="text-[15px] font-extrabold text-navy-700">Attendance</h2>
            <div className="mt-3 flex flex-wrap items-center gap-5">
              <Ring
                value={data.attendance.percentage}
                size={112}
                label="attendance"
                sub={data.attendance.total > 0 ? `${data.attendance.present}/${data.attendance.total} present` : "No records"}
              />
              <div className="min-w-48 flex-1">
                {data.attendance.total > 0 ? (
                  <Bars
                    rows={[
                      { label: "Present", value: Math.round((data.attendance.present / data.attendance.total) * 1000) / 10, hint: String(data.attendance.present) },
                      { label: "Absent", value: Math.round((data.attendance.absent / data.attendance.total) * 1000) / 10, hint: String(data.attendance.absent) },
                      { label: "Late", value: Math.round((data.attendance.late / data.attendance.total) * 1000) / 10, hint: String(data.attendance.late) },
                      { label: "Leave", value: Math.round((data.attendance.leave / data.attendance.total) * 1000) / 10, hint: String(data.attendance.leave) },
                    ]}
                  />
                ) : (
                  <p className="rounded-xl bg-silver-50 px-4 py-6 text-center text-[13px] font-bold text-muted">
                    No attendance data yet.
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/student/attendance"
              className="mt-3 inline-block text-[13px] font-bold text-teal-600 hover:underline"
            >
              Full attendance →
            </Link>
          </div>
        </div>
      )}
    </StudentShell>
  );
}
