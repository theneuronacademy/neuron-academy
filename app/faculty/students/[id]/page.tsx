"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { AttendanceHeatmap } from "@/components/analytics/AttendanceHeatmap";

interface ResultRow { id: string; percentage: number; marks: number; totalMarks: number; updatedAt: string; test: { title: string } }
interface View {
  student: {
    id: string; studentId: string; name: string; email: string; phone: string;
    status: string; studentType: string; parentName: string | null; parentMobile: string | null;
    batch: { id: string; name: string } | null;
  };
  results: ResultRow[];
  attendance: { PRESENT: number; ABSENT: number; LATE: number; LEAVE: number; total: number; percentage: number | null };
  attempts: { status: string; count: number }[];
  avgScore: number | null;
}

export default function FacultyStudent360Page() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [view, setView] = React.useState<View | null>(null);
  const [monthDays, setMonthDays] = React.useState<{ date: string; status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE" }[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [smsState, setSmsState] = React.useState<string | null>(null);
  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      try {
        const vR = await fetch(`/api/faculty/students/${params.id}`, { cache: "no-store" });
        if (vR.status === 401) { router.replace("/faculty/login"); return; }
        const vJ = await vR.json().catch(() => null);
        if (!live) return;
        if (vR.ok && vJ?.success) {
          setView(vJ.data as View);
          // Month heatmap via scoped attendance list (own batches only).
          try {
            const batchId = (vJ.data as View).student.batch?.id ?? "";
            const hR = await fetch(`/api/attendance?batchId=${encodeURIComponent(batchId)}`, { cache: "no-store" });
            const hJ = await hR.json().catch(() => null);
            const recs = Array.isArray(hJ?.data?.records) ? hJ.data.records : [];
            setMonthDays(
              recs
                .filter((r: { studentId: string }) => r.studentId === params.id)
                .map((r: { date: string; status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE" }) => ({ date: String(r.date).slice(0, 10), status: r.status }))
            );
          } catch {
            /* heatmap optional */
          }
        } else {
          setErr(vJ?.error ?? "Student not found.");
        }
      } catch {
        if (live) setErr("Cannot reach the server.");
      }
    })();
    return () => { live = false; };
  }, [router, params.id]);

  async function sendReportSms() {
    if (!view) return;
    setSmsState("Sending…");
    try {
      const msg =
        `Neuron Academy: ${view.student.name} — Attendance ${view.attendance.percentage ?? "—"}%, ` +
        `Avg score ${view.avgScore ?? "—"}% (${view.results.length} tests). - ${view.student.batch?.name ?? ""}`;
      const res = await fetch("/api/faculty/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: view.student.batch?.id ?? "", title: `Progress update: ${view.student.name}`, message: msg }),
      });
      // Announcements go to the whole batch; for a 1:1 parent ping the
      // faculty uses the student's phone directly from the card below.
      const json = await res.json().catch(() => null);
      setSmsState(res.ok && json?.success ? "Shared with batch feed." : (json?.error ?? "Could not share."));
    } catch {
      setSmsState("Cannot reach the server.");
    }
  }

  if (err) {
    return (
      <FacultyShell title="Student 360°" subtitle="Profile timeline">
        <p className="rounded-card border border-crimson-200 bg-crimson-50 p-6 text-sm font-bold text-crimson-600" role="alert">{err}</p>
        <Link href="/faculty/students" className="mt-3 inline-block text-sm font-bold text-teal-700 underline">← Back to students</Link>
      </FacultyShell>
    );
  }

  if (!view) {
    return (
      <FacultyShell title="Student 360°" subtitle="Profile timeline">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading profile…</p>
      </FacultyShell>
    );
  }

  const st = view.student;
  return (
    <FacultyShell title={st.name} subtitle={`${st.studentId} · ${st.batch?.name ?? "No batch"} · ${st.studentType}`}>
      <Link href="/faculty/students" className="text-sm font-bold text-teal-700 underline">← Back to students</Link>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Avg Score", view.avgScore == null ? "—" : `${view.avgScore}%`],
          ["Attendance", view.attendance.percentage == null ? "—" : `${view.attendance.percentage}%`],
          ["Tests", String(view.results.length)],
          ["Attempts", String(view.attempts.reduce((s, a) => s + a.count, 0))],
        ].map(([l, v]) => (
          <div key={l} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold tracking-widest text-muted">{l}</p>
            <p className="mt-1 text-2xl font-extrabold text-navy-700">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="text-[15px] font-extrabold text-navy-700">Contact</p>
          <p className="mt-2 text-sm text-navy-700">📞 <a className="font-bold underline" href={`tel:${st.phone}`}>{st.phone}</a> · {st.email}</p>
          <p className="mt-1 text-sm text-navy-700">👪 {st.parentName ?? "—"}{st.parentMobile ? (<> · <a className="font-bold underline" href={`tel:${st.parentMobile}`}>{st.parentMobile}</a></>) : null}</p>
          <button onClick={sendReportSms} className="mt-3 rounded-xl bg-navy-700 px-4 py-2 text-[13px] font-bold text-white hover:bg-navy-800">
            Share progress to batch feed
          </button>
          {smsState ? <p className="mt-2 text-[12px] font-bold text-muted" role="status">{smsState}</p> : null}
        </div>

        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="text-[15px] font-extrabold text-navy-700">This month</p>
          <div className="mt-2 max-w-xs">
            <AttendanceHeatmap month={month} days={monthDays} />
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Present {view.attendance.PRESENT} · Absent {view.attendance.ABSENT} · Late {view.attendance.LATE} · Leave {view.attendance.LEAVE} (all-time)
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-card border border-silver-200 bg-white p-5 shadow-card">
        <p className="text-[15px] font-extrabold text-navy-700">Score timeline</p>
        {view.results.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No evaluated results yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {view.results.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-silver-50 px-3 py-2">
                <p className="min-w-0 truncate text-[13px] font-bold text-navy-700">{r.test.title}</p>
                <p className="shrink-0 text-[13px] font-extrabold text-navy-700">{r.percentage}% <span className="font-semibold text-muted">({r.marks}/{r.totalMarks})</span></p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FacultyShell>
  );
}
