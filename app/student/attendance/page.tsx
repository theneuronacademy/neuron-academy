"use client";

import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { Bars, Ring, Skeleton } from "@/components/student/charts";
import { cn } from "@/lib/utils";

interface AttRow { id: string; date: string; status: string; source: string }
interface Summary { total: number; present: number; absent: number; late: number; leave: number; percentage: number | null }

/** Phase 14 — own attendance (REGULAR only, read-only, server data). */
export default function StudentAttendancePage() {
  const session = useStudentGuard();
  const [items, setItems] = useState<AttRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [month, setMonth] = useState("");

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const q = month ? `?month=${encodeURIComponent(month)}` : "";
        const res = await fetch(`/api/students/me/attendance${q}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        if (res.ok && json?.success === true) {
          setItems(json.data.items as AttRow[]);
          setSummary(json.data.summary as Summary);
        } else {
          setItems([]);
        }
      } catch {
        setItems([]);
      }
    })();
  }, [session, month]);

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (forbidden) {
    return (
      <StudentShell title="Attendance" subtitle="Regular students">
        <p className="rounded-card bg-white p-8 text-center text-sm font-bold text-muted">Attendance tracking is available for regular students only.</p>
      </StudentShell>
    );
  }

  const tone = (s: string) =>
    s === "PRESENT" ? "bg-teal-50 text-teal-700" : s === "ABSENT" ? "bg-crimson-50 text-crimson" : s === "LATE" ? "bg-amber-50 text-amber-700" : "bg-silver-100 text-muted";

  return (
    <StudentShell title="My Attendance" subtitle="From academy records — biometric + manual">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="h-fit rounded-card border border-silver-200 bg-white p-5 text-center shadow-card">
          {summary === null ? <Skeleton className="mx-auto h-28 w-28 rounded-full" /> : (
            <Ring value={summary.percentage} size={128} label="overall" sub={summary.total > 0 ? `${summary.present}/${summary.total} days` : "No records"} />
          )}
          {summary && summary.total > 0 ? (
            <div className="mt-4 text-left">
              <Bars rows={[
                { label: "Present", value: Math.round((summary.present / summary.total) * 1000) / 10, hint: String(summary.present) },
                { label: "Absent", value: Math.round((summary.absent / summary.total) * 1000) / 10, hint: String(summary.absent) },
                { label: "Late", value: Math.round((summary.late / summary.total) * 1000) / 10, hint: String(summary.late) },
                { label: "Leave", value: Math.round((summary.leave / summary.total) * 1000) / 10, hint: String(summary.leave) },
              ]} />
            </div>
          ) : null}
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-navy-700"><CalendarCheck className="h-4 w-4" /> Daily Records</h2>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Filter by month" className="rounded-xl border border-silver-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none" />
          </div>
          {items === null ? (
            <div className="mt-3 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : items.length === 0 ? (
            <p className="mt-3 rounded-xl bg-silver-50 px-4 py-8 text-center text-sm font-bold text-muted">No attendance data yet.</p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {items.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-silver-50 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-extrabold text-navy-700">{new Date(a.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                    <p className="text-[11px] font-bold text-muted">{a.source === "BIOMETRIC" ? "Biometric" : "Manual"}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-extrabold", tone(a.status))}>{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </StudentShell>
  );
}
