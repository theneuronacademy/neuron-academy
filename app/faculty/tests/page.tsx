"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";

interface TestRow { id: string; title: string; batch: string; batchId: string | null; status: string; type: string; totalMarks: number; startTime: string | null }

export default function FacultyTestsPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<TestRow[]>([]);
  const [ready, setReady] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [batchId, setBatchId] = React.useState("");
  const [batches, setBatches] = React.useState<Array<{ id: string; name: string }>>([]);
  const [err, setErr] = React.useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/tests", { cache: "no-store" });
    if (r.status === 401) { router.replace("/faculty/login"); return; }
    const j = await r.json().catch(() => null);
    if (r.ok && j?.success && Array.isArray(j.data?.items)) {
      setRows(j.data.items.map((t: { id: string; title: string; batch?: { id?: string; name?: string } | null; batchId?: string | null; status: string; type: string; totalMarks: number; startTime?: string | null }) => ({
        id: String(t.id), title: String(t.title), batch: String(t.batch?.name ?? "Open"), batchId: t.batchId ?? t.batch?.id ?? null,
        status: String(t.status), type: String(t.type), totalMarks: Number(t.totalMarks ?? 0),
        startTime: t.startTime ? new Date(t.startTime).toLocaleString() : null,
      })));
    }
    setReady(true);
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      const bR = await fetch("/api/faculty/batches", { cache: "no-store" });
      const bJ = await bR.json().catch(() => null);
      if (live && bR.ok && bJ?.success && Array.isArray(bJ.data?.items)) setBatches(bJ.data.items.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })));
      if (live) await load();
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function createTest() {
    if (!title.trim()) { setErr("Title is required."); return; }
    setErr(null);
    const res = await fetch("/api/tests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), batchId: batchId || undefined, type: "PRACTICE", status: "DRAFT" }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || j?.success !== true) { setErr(j?.error ?? "Create failed. Faculty can create only for assigned batches."); return; }
    setTitle("");
    await load();
  }

  return (
    <FacultyShell title="Tests" subtitle="Tests you created or for your assigned batches">
      {err ? <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p> : null}
      <div className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-navy-700">Create draft test (assigned batches only, FREE type)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Test title" className="min-w-[200px] flex-1 rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700">
            <option value="">Open (no batch)</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button onClick={() => void createTest()} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800">Create Draft</button>
        </div>
        <p className="mt-2 text-[12px] text-muted">Publishing, access type and price remain admin-controlled.</p>
      </div>
      {!ready ? (
        <p className="mt-3 rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading tests</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No tests visible for your batches yet.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {rows.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-silver-200 bg-white px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-navy-700">{t.title}</p>
                <p className="text-[12px] text-muted">{t.batch} | {t.type} | {t.totalMarks} marks {t.startTime ? `| ${t.startTime}` : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-silver-100 px-2.5 py-1 text-[11px] font-bold text-muted">{t.status}</span>
                <Link href={`/faculty/results?testId=${t.id}`} className="rounded-lg border border-silver-300 px-3 py-1.5 text-[12px] font-bold hover:border-teal-500">Results</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </FacultyShell>
  );
}
