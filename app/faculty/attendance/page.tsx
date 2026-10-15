"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { cn } from "@/lib/utils";

interface BatchOpt { id: string; name: string }
interface AttStudent { id: string; studentId: string; name: string; status: string }
type AttStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

export default function FacultyAttendancePage() {
  const router = useRouter();
  const [batches, setBatches] = React.useState<BatchOpt[]>([]);
  // Deep-link (?batchId=) is read client-side only so prerender stays static-safe.
  const [batchId, setBatchId] = React.useState("");
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [students, setStudents] = React.useState<AttStudent[]>([]);
  const [marks, setMarks] = React.useState<Record<string, AttStatus>>({});
  const [saved, setSaved] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const q = new URLSearchParams(window.location.search).get("batchId");
        if (live && q) setBatchId(q);
      } catch {
        /* ignore */
      }
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      const bR = await fetch("/api/faculty/batches", { cache: "no-store" });
      const bJ = await bR.json().catch(() => null);
      if (live && bR.ok && bJ?.success && Array.isArray(bJ.data?.items)) {
        const items = bJ.data.items.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }));
        setBatches(items);
        if (!batchId && items.length > 0) setBatchId(items[0].id);
      }
      if (live) setReady(true);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!ready || !batchId || !date) return;
    let live = true;
    (async () => {
      setErr(null);
      const [sR, aR] = await Promise.all([
        fetch(`/api/faculty/students?batchId=${encodeURIComponent(batchId)}`, { cache: "no-store" }),
        fetch(`/api/attendance?batchId=${encodeURIComponent(batchId)}&date=${encodeURIComponent(date)}`, { cache: "no-store" }),
      ]);
      if (!live) return;
      if (sR.status === 403 || aR.status === 403) { setErr("Forbidden: batch not assigned to you."); return; }
      const sJ = await sR.json().catch(() => null);
      const aJ = await aR.json().catch(() => null);
      const list: AttStudent[] = (sJ?.data?.items ?? []).map((r: { id: string; studentId: string; name: string; status: string }) => ({ id: r.id, studentId: r.studentId, name: r.name, status: r.status }));
      setStudents(list);
      const existing: Record<string, AttStatus> = {};
      for (const rec of (aJ?.data?.records ?? []) as Array<{ studentId: string; status: AttStatus; source?: string }>) {
        existing[rec.studentId] = rec.status;
      }
      const next: Record<string, AttStatus> = {};
      for (const st of list) next[st.id] = existing[st.id] ?? "PRESENT";
      setMarks(next);
    })();
    return () => { live = false; };
  }, [ready, batchId, date]);

  async function save() {
    if (!batchId || !date || busy) return;
    setBusy(true);
    setErr(null);
    setSaved(null);
    try {
      for (const st of students) {
        const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: st.id, batchId, date, status: marks[st.id] ?? "PRESENT", source: "MANUAL" }),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || j?.success !== true) {
          setErr(j?.error ?? `Failed to save attendance for ${st.name}.`);
          setBusy(false);
          return;
        }
      }
      setSaved(`Attendance saved for ${students.length} students (${date}). Source: MANUAL.`);
      window.setTimeout(() => setSaved(null), 3000);
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <FacultyShell title="Attendance" subtitle="Mark attendance for your batches">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading attendance</p>
      </FacultyShell>
    );
  }

  const counts = (Object.values(marks) as AttStatus[]).reduce((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <FacultyShell title="Attendance" subtitle="Manual attendance — source MANUAL, biometric records are protected">
      {err ? <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p> : null}
      {saved ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">{saved}</p> : null}
      <div className="flex flex-wrap gap-2">
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700" aria-label="Batch">
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-silver-300 px-3 py-2 text-sm" aria-label="Date" />
        <button onClick={() => void save()} disabled={busy || students.length === 0} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-60">{busy ? "Saving" : "Save Attendance"}</button>
        <button
          onClick={() => setMarks(Object.fromEntries(students.map((st) => [st.id, "PRESENT" as AttStatus])))}
          disabled={busy || students.length === 0}
          title="Set everyone to PRESENT, then adjust exceptions"
          className="rounded-xl border border-teal-500 px-4 py-2 text-sm font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-60"
        >
          ✓ All Present
        </button>
      </div>
      <p className="mt-2 text-[12px] text-muted">Present: {counts.PRESENT ?? 0} | Absent: {counts.ABSENT ?? 0} | Late: {counts.LATE ?? 0} | Leave: {counts.LEAVE ?? 0}</p>
      {students.length === 0 ? (
        <p className="mt-3 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">Select a batch with students to mark attendance.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {students.map((st) => (
            <li key={st.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-silver-200 bg-white px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-navy-700">{st.name}</p>
                <p className="text-[12px] text-muted">{st.studentId}</p>
              </div>
              <div className="flex gap-1.5" role="group" aria-label={`Attendance for ${st.name}`}>
                {(["PRESENT", "ABSENT", "LATE", "LEAVE"] as AttStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setMarks((m) => ({ ...m, [st.id]: s }))}
                    className={cn("rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold", marks[st.id] === s ? "bg-navy-700 text-white" : "border border-silver-300 text-navy-700 hover:border-teal-500")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </FacultyShell>
  );
}
