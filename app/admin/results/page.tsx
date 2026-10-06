"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { Button } from "@/components/ui/primitives";
import { getResults, getTests, saveResult, uid, nowISO } from "@/lib/storage";
import { OfflineMarksForm } from "@/components/admin/OfflineMarksForm";
import { isDbLive } from "@/services/dbLive";
import type { TestResult } from "@/lib/testTypes";

const inputCls = "w-full rounded-xl border border-silver-300 bg-white px-3.5 py-2 text-sm focus:border-teal-500 focus:outline-none";
const labelCls = "mb-1 block text-[11px] font-bold tracking-wide text-navy-700";

export default function AdminResultsPage() {
  const ready = useAdminGuard();
  const [tick, setTick] = useState(0);
  const [testFilter, setTestFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [sid, setSid] = useState("");
  const [sname, setSname] = useState("");
  const [tname, setTname] = useState("");
  const [marks, setMarks] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    const onUpd = () => setTick((t) => t + 1);
    window.addEventListener("neuron-test-updated", onUpd);
    return () => window.removeEventListener("neuron-test-updated", onUpd);
  }, []);

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  void tick;
  const tests = getTests();
  let results = getResults();
  if (testFilter !== "all") results = results.filter((r) => r.testId === testFilter);
  if (search.trim()) {
    const s = search.toLowerCase();
    results = results.filter((r) => `${r.studentName} ${r.studentId} ${r.testName}`.toLowerCase().includes(s));
  }

  return (
    <AdminLayout title="Results" subtitle={`${results.length} results • auto-evaluated + offline uploads`}>
      <DbResultsPanel />
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student / test…" aria-label="Search results" className="min-w-[180px] flex-1 rounded-xl border border-silver-300 bg-white px-4 py-2 text-sm sm:max-w-xs" />
        <select value={testFilter} onChange={(e) => setTestFilter(e.target.value)} aria-label="Filter by test" className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm">
          <option value="all">All Tests</option>
          {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={() => window.alert("Export is UI-only in this demo phase.")} className="rounded-xl border border-silver-300 bg-white px-4 py-2 text-sm font-bold text-navy-700">Export</button>
      </div>

      {results.length === 0 ? (
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
                <th className="px-4 py-3 font-bold">TIME</th>
                <th className="px-4 py-3 font-bold">DATE</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-silver-100 last:border-0">
                  <td className="px-4 py-3 font-extrabold text-navy-700">{r.testName}{r.manual ? " (offline)" : ""}</td>
                  <td className="px-4 py-3">{r.studentName}<span className="block text-[12px] text-muted">{r.studentId}</span></td>
                  <td className="px-4 py-3 font-extrabold">{r.marks}/{r.maxMarks}</td>
                  <td className="px-4 py-3 font-bold">{r.percentage}%</td>
                  <td className="px-4 py-3 text-[12px]">{r.correct} ✓ / {r.incorrect} ✗ / {r.unattempted} –{r.pending ? ` • ${r.pending} pending` : ""}</td>
                  <td className="px-4 py-3">{Math.floor(r.timeTakenSec / 60)}m {r.timeTakenSec % 60}s</td>
                  <td className="px-4 py-3 text-[12px] text-muted">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <h2 className="text-[15px] font-extrabold text-navy-700">Upload Offline Marks (CSV — demo UI)</h2>
          <p className="mt-1 text-[13px] text-muted">Future backend will parse <code>studentId,studentName,marks</code>. For now, paste CSV rows to preview parsing.</p>
          <textarea
            rows={4}
            placeholder={"STU-1001, Student Name, 16\nSTU-1002, Second Student, 14"}
            aria-label="Offline marks CSV"
            className="mt-3 w-full rounded-xl border border-silver-300 px-3.5 py-2 font-mono text-[13px]"
            onChange={(e) => {
              const rows = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
              const ok = rows.filter((r) => r.split(",").length >= 3).length;
              setCsvMsg(rows.length === 0 ? null : `${ok}/${rows.length} rows look valid (UI-only preview — connect backend to save).`);
            }}
          />
          {csvMsg ? <p className="mt-2 text-[13px] font-bold text-teal-700">{csvMsg}</p> : null}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => window.alert("CSV import connects to the backend in production. Manual entry below saves today.")}>Validate CSV</Button>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <h2 className="text-[15px] font-extrabold text-navy-700">Save Offline Result (manual)</h2>
          {savedMsg ? <p className="mt-2 rounded-xl bg-teal-50 px-3 py-2 text-[13px] font-bold text-teal-700" role="status">{savedMsg}</p> : null}
          <div className="mt-3 grid gap-2.5">
            <div><label className={labelCls} htmlFor="om-sid">Student ID *</label><input id="om-sid" className={inputCls} value={sid} onChange={(e) => setSid(e.target.value)} placeholder="STU-1001" /></div>
            <div><label className={labelCls} htmlFor="om-sn">Student Name *</label><input id="om-sn" className={inputCls} value={sname} onChange={(e) => setSname(e.target.value)} placeholder="Student Name" /></div>
            <div><label className={labelCls} htmlFor="om-tn">Test Name *</label><input id="om-tn" className={inputCls} value={tname} onChange={(e) => setTname(e.target.value)} placeholder="Percentage Practice Test 01" /></div>
            <div><label className={labelCls} htmlFor="om-m">Marks *</label><input id="om-m" className={inputCls} value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="16 / 20" /></div>
            <Button
              onClick={() => {
                if (!sid.trim() || !sname.trim() || !tname.trim() || !marks.trim()) {
                  setSavedMsg("Fill all fields first.");
                  return;
                }
                const r: TestResult = {
                  id: uid("res"),
                  testId: "offline",
                  testName: tname.trim(),
                  studentId: sid.trim(),
                  studentName: sname.trim(),
                  total: 0, attempted: 0, correct: 0, incorrect: 0, unattempted: 0, pending: 0,
                  marks: Number.parseFloat(marks) || 0,
                  maxMarks: Number.parseFloat(marks) || 0,
                  percentage: 100, accuracy: 100, timeTakenSec: 0,
                  details: [], createdAt: nowISO(), manual: true,
                };
                saveResult(r);
                setSavedMsg("Offline result saved — visible in the table above.");
                setTick((t) => t + 1);
                setSid(""); setSname(""); setTname(""); setMarks("");
              }}
            >
              Save Results
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// Phase 6 — database results panel (rendered only when PostgreSQL is live).
// Local demo table below stays untouched as the fallback.
interface DbRow {
  id: string;
  testId: string;
  testTitle: string;
  studentId: string;
  studentName: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  rank: number | null;
  attempted: number;
  correct: number;
  wrong: number;
  unanswered: number;
  date: string;
}

function DbResultsPanel() {
  const [live, setLive] = useState(false);
  const [rows, setRows] = useState<DbRow[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"date" | "marks">("date");

  useEffect(() => {
    (async () => {
      if (!(await isDbLive())) return;
      try {
        const res = await fetch("/api/results", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (json?.success === true && Array.isArray(json.data?.items)) {
          setRows(json.data.items);
          setLive(true);
        }
      } catch {
        /* stay hidden */
      }
    })();
  }, []);

  if (!live) return null;
  const filtered = rows
    .filter((r) => !q.trim() || `${r.studentName} ${r.testTitle}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "marks" ? b.marks - a.marks : b.date.localeCompare(a.date)));

  return (
    <div className="grid gap-4 rounded-card border border-teal-100 bg-teal-50/50 p-4">
      <div>
        <h2 className="text-[15px] font-extrabold text-navy-700">Database Results ({rows.length}) + Offline Entry</h2>
        <p className="mt-0.5 text-[13px] text-muted">Live PostgreSQL rows. Percentage is always computed server-side.</p>
        <div className="mt-3 rounded-card border border-silver-200 bg-white p-4">
          <OfflineMarksForm />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student / test…" aria-label="Search database results" className="min-w-[180px] flex-1 rounded-xl border border-silver-300 bg-white px-4 py-2 text-sm sm:max-w-xs" />
        <select value={sort} onChange={(e) => setSort(e.target.value as "date" | "marks")} aria-label="Sort results" className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm font-bold text-navy-700">
          <option value="date">Sort: Newest</option>
          <option value="marks">Sort: Marks ↓</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-6 text-center text-sm font-bold text-muted">No database results yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-silver-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-silver-200 bg-silver-50 text-[11px] tracking-widest text-muted">
                <th className="px-4 py-3 font-bold">TEST</th>
                <th className="px-4 py-3 font-bold">STUDENT</th>
                <th className="px-4 py-3 font-bold">SCORE</th>
                <th className="px-4 py-3 font-bold">%</th>
                <th className="px-4 py-3 font-bold">C / W / –</th>
                <th className="px-4 py-3 font-bold">DATE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-silver-100 last:border-0">
                  <td className="px-4 py-3 font-extrabold text-navy-700">{r.testTitle}</td>
                  <td className="px-4 py-3">{r.studentName}</td>
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
    </div>
  );
}
