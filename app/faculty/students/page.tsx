"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";

interface StudentRow {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  batchId: string | null;
  batch: string;
  attendancePct: number | null;
  testsTaken: number;
  avgScore: number | null;
}

interface BatchOpt { id: string; name: string }

export default function FacultyStudentsPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<StudentRow[]>([]);
  const [batches, setBatches] = React.useState<BatchOpt[]>([]);
  const [search, setSearch] = React.useState("");
  // Deep-link (?batchId=) is read client-side only so prerender stays static-safe.
  const [batchId, setBatchId] = React.useState("");
  const [ready, setReady] = React.useState(false);

  async function load(nextSearch = search, nextBatch = batchId) {
    const q = new URLSearchParams();
    if (nextSearch.trim()) q.set("search", nextSearch.trim());
    if (nextBatch) q.set("batchId", nextBatch);
    const r = await fetch(`/api/faculty/students?${q.toString()}`, { cache: "no-store" });
    if (r.status === 401) { router.replace("/faculty/login"); return; }
    const j = await r.json().catch(() => null);
    if (r.ok && j?.success && Array.isArray(j.data?.items)) setRows(j.data.items);
    setReady(true);
  }

  useEffect(() => {
    let live = true;
    (async () => {
      let qb = "";
      try {
        qb = new URLSearchParams(window.location.search).get("batchId") ?? "";
      } catch {
        /* ignore */
      }
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      const bR = await fetch("/api/faculty/batches", { cache: "no-store" });
      const bJ = await bR.json().catch(() => null);
      if (live && bR.ok && bJ?.success && Array.isArray(bJ.data?.items)) {
        setBatches(bJ.data.items.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })));
      }
      if (live) {
        if (qb) setBatchId(qb);
        await load(search, qb);
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <FacultyShell title="Students" subtitle="Only students in your assigned batches">
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void load(); }} placeholder="Search name, email, phone" className="min-w-[200px] flex-1 rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500" />
        <select value={batchId} onChange={(e) => { setBatchId(e.target.value); void load(search, e.target.value); }} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700">
          <option value="">All my batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button onClick={() => void load()} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800">Search</button>
      </div>
      {!ready ? (
        <p className="mt-3 rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading students</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No students found for your filters.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-card border border-silver-200 bg-white shadow-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-silver-100 text-[11px] text-muted">
                <th className="p-3">Student</th>
                <th className="p-3">Batch</th>
                <th className="p-3">Status</th>
                <th className="p-3">Attendance</th>
                <th className="p-3">Tests</th>
                <th className="p-3">Avg</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-silver-100 last:border-0">
                  <td className="p-3"><p className="font-extrabold text-navy-700">{r.name}</p><p className="text-[12px] text-muted">{r.studentId}</p></td>
                  <td className="p-3 text-[13px]">{r.batch}</td>
                  <td className="p-3 text-[13px]">{r.status}</td>
                  <td className="p-3 text-[13px] font-bold">{r.attendancePct == null ? "—" : `${r.attendancePct}%`}</td>
                  <td className="p-3 text-[13px]">{r.testsTaken}</td>
                  <td className="p-3 text-[13px]">{r.avgScore == null ? "—" : `${r.avgScore}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[12px] text-muted">Contact details are role-appropriate. Passwords, OTPs and session data are never exposed. <Link href="/faculty/attendance" className="font-bold text-teal-600 hover:underline">Mark attendance</Link></p>
    </FacultyShell>
  );
}
