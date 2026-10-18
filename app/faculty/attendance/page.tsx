// Faculty Attendance Page - Mark attendance with bulk save
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { useFacultyBatches, useFacultyStudents, useAttendance, useBulkSaveAttendance } from "@/lib/faculty-hooks";
import { cn } from "@/lib/utils";

type AttStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

interface AttStudent {
  id: string;
  studentId: string;
  name: string;
  status: string;
}

export default function FacultyAttendancePage() {
  const router = useRouter();
  const { data: batches } = useFacultyBatches();
  const [batchId, setBatchId] = React.useState("");
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = React.useState<Record<string, AttStatus>>({});
  const [saved, setSaved] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const { data: students, isLoading: studentsLoading } = useFacultyStudents({ batchId: batchId || undefined });
  const { data: attendanceRecords, isLoading: attendanceLoading, refetch } = useAttendance(batchId, date);
  const bulkSaveMut = useBulkSaveAttendance({
    onSuccess: (data) => {
      setSaved(`Attendance saved for ${data.saved} students (${date}). Source: MANUAL.`);
      setTimeout(() => setSaved(null), 3000);
      refetch();
    },
    onError: (error) => setErr(error.message),
  });

  useEffect(() => {
    if (batches?.length && !batchId) setBatchId(batches[0].id);
  }, [batches, batchId]);

  useEffect(() => {
    if (!attendanceRecords) return;
    const existing: Record<string, AttStatus> = {};
    for (const rec of attendanceRecords) {
      existing[rec.studentId] = rec.status;
    }
    const list = students ?? [];
    const next: Record<string, AttStatus> = {};
    for (const st of list) next[st.id] = existing[st.id] ?? "PRESENT";
    setMarks(next);
  }, [attendanceRecords, students]);

  async function handleSave() {
    if (!batchId || !date || busy || !students?.length) return;
    setBusy(true);
    setErr(null);
    setSaved(null);

    const records = students.map((st) => ({
      studentId: st.id,
      status: marks[st.id] ?? "PRESENT",
    }));

    try {
      await bulkSaveMut.mutateAsync({ batchId, date, records });
    } catch {
      // Error handled by onError
    } finally {
      setBusy(false);
    }
  }

  function setAllPresent() {
    if (!students?.length) return;
    setMarks(Object.fromEntries(students.map((st) => [st.id, "PRESENT" as AttStatus])));
  }

  const counts = (Object.values(marks) as AttStatus[]).reduce((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {} as Record<string, number>);

  const isLoading = studentsLoading || attendanceLoading;

  if (isLoading) {
    return (
      <FacultyShell title="Attendance" subtitle="Mark attendance for your batches">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading attendance…</p>
      </FacultyShell>
    );
  }

  return (
    <FacultyShell title="Attendance" subtitle="Manual attendance — source MANUAL, biometric records are protected">
      {err && <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p>}
      {saved && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">{saved}</p>}

      <div className="flex flex-wrap gap-2">
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700" aria-label="Batch">
          {batches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-silver-300 px-3 py-2 text-sm" aria-label="Date" />
        <button onClick={handleSave} disabled={busy || !students?.length || bulkSaveMut.isPending} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-60">
          {busy || bulkSaveMut.isPending ? "Saving…" : "Save Attendance"}
        </button>
        <button onClick={setAllPresent} disabled={busy || !students?.length} title="Set everyone to PRESENT, then adjust exceptions" className="rounded-xl border border-teal-500 px-4 py-2 text-sm font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-60">
          ✓ All Present
        </button>
      </div>

      <p className="mt-2 text-[12px] text-muted">Present: {counts.PRESENT ?? 0} | Absent: {counts.ABSENT ?? 0} | Late: {counts.LATE ?? 0} | Leave: {counts.LEAVE ?? 0}</p>

      {students?.length === 0 ? (
        <p className="mt-3 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">Select a batch with students to mark attendance.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {students!.map((st) => (
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