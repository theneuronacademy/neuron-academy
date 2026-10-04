"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

// Phase 6 — shared offline marks entry (admin results page + faculty dashboard).
// Server computes percentage; the client preview is display-only and the
// client never sends an authoritative percentage.

interface DbTest {
  id: string;
  title: string;
  type: string;
  totalMarks: number;
  batchId: string | null;
}

interface DbStudent {
  id: string;
  studentId: string;
  name: string;
}

export function OfflineMarksForm() {
  const [tests, setTests] = useState<DbTest[]>([]);
  const [students, setStudents] = useState<DbStudent[]>([]);
  const [testId, setTestId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [marks, setMarks] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tests", { cache: "no-store" });
        const json = await res.json();
        if (json?.success === true && Array.isArray(json.data?.items)) {
          setTests(json.data.items.filter((t: DbTest) => t.type === "OFFLINE"));
        }
      } catch {
        /* demo mode */
      }
    })();
  }, []);

  useEffect(() => {
    setStudents([]);
    setStudentId("");
    const t = tests.find((x) => x.id === testId);
    if (!t?.batchId) return;
    (async () => {
      try {
        const res = await fetch(`/api/batches/${t.batchId}/students`, { cache: "no-store" });
        const json = await res.json();
        if (json?.success === true && Array.isArray(json.data?.items)) setStudents(json.data.items);
      } catch {
        /* demo mode */
      }
    })();
  }, [testId, tests]);

  const test = tests.find((x) => x.id === testId);
  const marksNum = Number(marks);
  const previewPct = test && test.totalMarks > 0 && marks !== "" ? Math.round((marksNum / test.totalMarks) * 1000) / 10 : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!testId || !studentId || marks === "") {
      setMsg({ ok: false, text: "Select a test, a student and enter marks." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/results/offline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, studentId, marks: marksNum }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        setMsg({ ok: true, text: `Saved: ${marksNum}/${test?.totalMarks} (${previewPct}%). Notification queued for the student.` });
        setMarks("");
      } else {
        setMsg({ ok: false, text: json?.error ?? "Could not save marks." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error. Offline marks need a database connection." });
    } finally {
      setBusy(false);
    }
  }

  if (tests.length === 0) {
    return (
      <p className="rounded-xl bg-silver-50 px-4 py-3 text-[13px] font-semibold text-muted">
        No OFFLINE tests in the database yet. Create one, then enter marks here. (Demo mode: use the manual entry below.)
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="block text-[12px] font-bold text-navy-700">
        Offline test
        <select value={testId} onChange={(e) => setTestId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500">
          <option value="">Select…</option>
          {tests.map((t) => (
            <option key={t.id} value={t.id}>{t.title} (/{t.totalMarks})</option>
          ))}
        </select>
      </label>
      <label className="block text-[12px] font-bold text-navy-700">
        Student
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!testId} className="mt-1.5 w-full rounded-xl border border-silver-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 disabled:opacity-50">
          <option value="">Select…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.studentId})</option>
          ))}
        </select>
      </label>
      <label className="block text-[12px] font-bold text-navy-700">
        Marks (max {test?.totalMarks ?? "—"})
        <input value={marks} onChange={(e) => setMarks(e.target.value)} type="number" min={0} step={0.5} placeholder="e.g. 42" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-50">
          {busy ? "Saving…" : "Save Marks"}
        </button>
      </div>
      <div className="flex items-end">
        <p className="w-full rounded-xl bg-silver-50 px-3 py-2.5 text-center text-[13px] font-bold text-navy-700">
          {previewPct === null ? "— %" : `${previewPct}% (preview)`}
        </p>
      </div>
      {msg ? (
        <p className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold sm:col-span-2 lg:col-span-5 ${msg.ok ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-crimson-100 bg-crimson-50 text-crimson-DEFAULT"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {msg.text}
        </p>
      ) : null}
    </form>
  );
}
