"use client";

// C5 canonicalization — admin results are API-authoritative ONLY.
// The table reads GET /api/results, the manual form posts to
// POST /api/results (server validates + computes percentage). CSV/export
// stay presentation-only. No localStorage result authority remains.

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { Button } from "@/components/ui/primitives";
import { OfflineMarksForm } from "@/components/admin/OfflineMarksForm";

const inputCls = "w-full rounded-xl border border-silver-300 bg-white px-3.5 py-2 text-sm focus:border-teal-500 focus:outline-none";
const labelCls = "mb-1 block text-[11px] font-bold tracking-wide text-navy-700";

interface ServerResult {
  id: string;
  testId: string;
  testTitle: string;
  studentId: string;
  studentName: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  correct: number;
  wrong: number;
  unanswered: number;
  date: string;
}

interface ServerTest {
  id: string;
  title: string;
}

export default function AdminResultsPage() {
  const ready = useAdminGuard();
  const [testFilter, setTestFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [testId, setTestId] = useState("");
  const [sid, setSid] = useState("");
  const [marks, setMarks] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [results, setResults] = useState<ServerResult[]>([]);
  const [tests, setTests] = useState<ServerTest[]>([]);

  async function load() {
    try {
      const [rRes, tRes] = await Promise.all([
        fetch("/api/results", { cache: "no-store" }),
        fetch("/api/tests", { cache: "no-store" }),
      ]);
      const rJson = await rRes.json().catch(() => null);
      const tJson = await tRes.json().catch(() => null);
      if (rJson?.success !== true || !Array.isArray(rJson.data?.items)) {
        setFailed(true);
        return;
      }
      setResults(rJson.data.items);
      if (tJson?.success === true && Array.isArray(tJson.data?.items)) {
        setTests(tJson.data.items.map((t: { id: string; title: string }) => ({ id: String(t.id), title: String(t.title) })));
      }
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready]);

  async function saveManual() {
    if (!testId || !sid.trim() || !marks.trim()) {
      setSavedMsg("Pick a test and fill student ID + marks first.");
      return;
    }
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, studentId: sid.trim(), marks: Number(marks) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setSavedMsg(json?.error ?? "Save failed.");
        return;
      }
      setSavedMsg("Result saved — visible in the table above.");
      setTestId("");
      setSid("");
      setMarks("");
      await load();
    } catch {
      setSavedMsg("Cannot reach the server.");
    }
  }

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  let visible = failed ? [] : results;
  if (testFilter !== "all") visible = visible.filter((r) => r.testId === testFilter);
  if (search.trim()) {
    const s = search.toLowerCase();
    visible = visible.filter((r) => `${r.studentName} ${r.studentId} ${r.testTitle}`.toLowerCase().includes(s));
  }

  return (
    <AdminLayout title="Results" subtitle={`${visible.length} results • auto-evaluated + offline uploads`}>
      {failed ? (
        <p className="mb-4 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">
          Results unavailable — check the database connection.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student / test…" aria-label="Search results" className="min-w-[180px] flex-1 rounded-xl border border-silver-300 bg-white px-4 py-2 text-sm sm:max-w-xs" />
        <select value={testFilter} onChange={(e) => setTestFilter(e.target.value)} aria-label="Filter by test" className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm">
          <option value="all">All Tests</option>
          {tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <button onClick={() => {
          // Phase 17 — real CSV export of the currently filtered rows.
          const header = "test,student,studentId,marks,totalMarks,percentage,correct,wrong,unanswered,date";
          const lines = visible.map((r) => [`"${String(r.testTitle).replace(/"/g, '""')}"`, `"${String(r.studentName).replace(/"/g, '""')}"`, r.studentId, r.marks, r.totalMarks, r.percentage, r.correct, r.wrong, r.unanswered, r.date].join(","));
          const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `results-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }} className="rounded-xl border border-silver-300 bg-white px-4 py-2 text-sm font-bold text-navy-700">Export CSV</button>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No results available. Publish a test and have a student attempt it.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-silver-200 bg-white shadow-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-silver-200 bg-silver-50 text-[11px] tracking-widest text-muted">
                <th className="px-4 py-3 font-bold">TEST</th>
                <th className="px-4 py-3 font-bold">STUDENT</th>
                <th className="px-4 py-3 font-bold">SCORE</th>
                <th className="px-4 py-3 font-bold">%</th>
                <th className="px-4 py-3 font-bold">C / W / S</th>
                <th className="px-4 py-3 font-bold">DATE</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-silver-100 last:border-0">
                  <td className="px-4 py-3 font-extrabold text-navy-700">{r.testTitle}</td>
                  <td className="px-4 py-3">{r.studentName}<span className="block text-[12px] text-muted">{r.studentId}</span></td>
                  <td className="px-4 py-3 font-extrabold">{r.marks}/{r.totalMarks}</td>
                  <td className="px-4 py-3 font-bold">{r.percentage}%</td>
                  <td className="px-4 py-3 text-[12px]">{r.correct} ✓ / {r.wrong} ✗ / {r.unanswered} –</td>
                  <td className="px-4 py-3 text-[12px] text-muted">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <h2 className="text-[15px] font-extrabold text-navy-700">Check Offline Marks Format (validator only)</h2>
          <p className="mt-1 text-[13px] text-muted">For offline entry use the manual form or the OFFLINE-test form below. Pasted rows only check the CSV shape — nothing is saved here.</p>
          <textarea
            rows={4}
            placeholder={"STU-1001, Student Name, 16\nSTU-1002, Second Student, 14"}
            aria-label="Offline marks CSV"
            className="mt-3 w-full rounded-xl border border-silver-300 px-3.5 py-2 font-mono text-[13px]"
            onChange={(e) => {
              const rows = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
              const ok = rows.filter((r) => r.split(",").length >= 3).length;
              setCsvMsg(rows.length === 0 ? null : `${ok}/${rows.length} rows match the expected shape (validator only — nothing saved).`);
            }}
          />
          {csvMsg ? <p className="mt-2 text-[13px] font-bold text-teal-700">{csvMsg}</p> : null}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setCsvMsg("Format checked above. Use manual entry or the OFFLINE-test form to save.")}>Validate CSV</Button>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <h2 className="text-[15px] font-extrabold text-navy-700">Save Result (manual, server)</h2>
          {savedMsg ? <p className="mt-2 rounded-xl bg-teal-50 px-3 py-2 text-[13px] font-bold text-teal-700" role="status">{savedMsg}</p> : null}
          <div className="mt-3 grid gap-2.5">
            <div>
              <label className={labelCls} htmlFor="om-test">Test *</label>
              <select id="om-test" className={inputCls} value={testId} onChange={(e) => setTestId(e.target.value)}>
                <option value="">Pick a test…</option>
                {tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div><label className={labelCls} htmlFor="om-sid">Student Record ID *</label><input id="om-sid" className={inputCls} value={sid} onChange={(e) => setSid(e.target.value)} placeholder="Student record ID" /></div>
            <div><label className={labelCls} htmlFor="om-m">Marks *</label><input id="om-m" className={inputCls} value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="16" /></div>
            <Button onClick={() => void saveManual()}>Save Results</Button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-card border border-silver-200 bg-white p-4 shadow-card">
        <h2 className="text-[15px] font-extrabold text-navy-700">Offline Test Entry</h2>
        <div className="mt-2">
          <OfflineMarksForm />
        </div>
      </div>
    </AdminLayout>
  );
}
