"use client";

// C5 canonicalization — the admin test list is API-authoritative ONLY.
// Reads come from GET /api/tests (ADMIN sees full rows); duplicate runs
// GET detail → POST create (DRAFT) → POST questions; delete runs
// DELETE /api/tests/[id]. No localStorage test state remains here.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Upload, Database, BarChart3, Search, Eye, Pencil, Copy, Trash2, Megaphone } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { TestStatusBadge } from "@/components/admin/TestStatusBadge";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import type { TestStatus } from "@/lib/testTypes";

interface ApiListTest {
  id: string;
  title: string;
  description: string | null;
  type: string;
  duration: number;
  status: string;
  batchId: string | null;
  createdById: string | null;
  createdAt: string;
  accessType?: string;
  batch?: { name?: string } | null;
  _count?: { questions?: number };
}

function badgeStatus(s: string): TestStatus {
  const v = s.toLowerCase();
  return (["draft", "scheduled", "published", "live", "completed", "archived"] as TestStatus[]).includes(v as TestStatus)
    ? (v as TestStatus)
    : "draft";
}

export default function AdminTestsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [tests, setTests] = useState<ApiListTest[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [tRes, rRes] = await Promise.all([
        fetch("/api/tests", { cache: "no-store" }),
        fetch("/api/results", { cache: "no-store" }),
      ]);
      const tJson = await tRes.json().catch(() => null);
      if (tJson?.success === true && Array.isArray(tJson.data?.items)) setTests(tJson.data.items);
      const rJson = await rRes.json().catch(() => null);
      if (rJson?.success === true && Array.isArray(rJson.data?.items)) setResultCount(rJson.data.items.length);
    } catch {
      setError("Cannot reach the server.");
    }
  }

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    setReady(true);
    void load();
  }, [router]);

  // Duplicate safely through the existing API: read the source test with
  // its questions, create a DRAFT copy, then copy questions one by one.
  async function duplicate(id: string) {
    setBusy(id);
    setError(null);
    try {
      const dRes = await fetch(`/api/tests/${id}`, { cache: "no-store" });
      const dJson = await dRes.json().catch(() => null);
      const src = dJson?.success === true ? dJson.data?.item : null;
      if (!src) throw new Error("source");
      const cRes = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${String(src.title ?? "Test")} (Copy)`,
          description: src.description ?? undefined,
          batchId: src.batchId ?? undefined,
          type: src.type,
          duration: src.duration,
          totalMarks: src.totalMarks,
          status: "DRAFT",
          questionOrder: src.questionOrder,
          optionOrder: src.optionOrder,
        }),
      });
      const cJson = await cRes.json().catch(() => null);
      const created = cJson?.success === true ? cJson.data?.item : null;
      if (!created) throw new Error("create");
      const qs = Array.isArray(src.questions) ? src.questions : [];
      for (const q of qs) {
        await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testId: created.id,
            questionText: q.questionText,
            optionA: q.optionA ?? undefined,
            optionB: q.optionB ?? undefined,
            optionC: q.optionC ?? undefined,
            optionD: q.optionD ?? undefined,
            optionE: q.optionE ?? undefined,
            correctAnswer: q.correctAnswer ?? undefined,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            explanation: q.explanation ?? undefined,
            order: q.order,
            subject: q.subject ?? undefined,
          }),
        });
      }
      await load();
    } catch {
      setError("Duplicate failed.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? Questions are deleted with it.`)) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/tests/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete");
      await load();
    } catch {
      setError("Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading tests…</div>;

  const lower = (s: string) => s.toLowerCase();
  const count = (s: string) => tests.filter((t) => (s === "all" ? true : lower(t.status) === s)).length;
  const filtered = tests.filter((t) => !search.trim() || `${t.title} ${t.type}`.toLowerCase().includes(search.toLowerCase()));

  const stats = [
    { label: "Total Tests", value: tests.length },
    { label: "Draft Tests", value: count("draft") },
    { label: "Scheduled", value: count("scheduled") },
    { label: "Live / Published", value: count("live") + count("published") },
    { label: "Completed", value: count("completed") },
    { label: "Total Questions", value: tests.reduce((n, t) => n + (t._count?.questions ?? 0), 0) },
  ];

  return (
    <AdminLayout title="Tests" subtitle="PDF → questions → test → student result">
      {error ? <p className="mb-4 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
            <p className="text-[11px] font-bold tracking-widest text-muted">{s.label.toUpperCase()}</p>
            <p className="mt-1 text-3xl font-extrabold text-navy-700">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 rounded-card bg-navy-800 p-5 text-white sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/tests/new" className="rounded-xl bg-crimson px-4 py-2.5 text-center text-sm font-bold hover:bg-crimson-bright">
          <Plus className="mr-1 inline h-4 w-4" />Create Test
        </Link>
        <Link href="/admin/tests/from-pdf" className="rounded-xl bg-teal-500 px-4 py-2.5 text-center text-sm font-bold hover:bg-teal-400">
          <Upload className="mr-1 inline h-4 w-4" />Upload PDF
        </Link>
        <Link href="/admin/question-bank" className="rounded-xl bg-white/10 px-4 py-2.5 text-center text-sm font-bold ring-1 ring-white/20 hover:bg-white/20">
          <Database className="mr-1 inline h-4 w-4" />Question Bank
        </Link>
        <Link href="/admin/results" className="rounded-xl bg-white/10 px-4 py-2.5 text-center text-sm font-bold ring-1 ring-white/20 hover:bg-white/20">
          <BarChart3 className="mr-1 inline h-4 w-4" />View Results ({resultCount})
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-navy-700">Recent Tests</h2>
        <label className="flex items-center gap-2 rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tests…" aria-label="Search tests" className="bg-transparent outline-none" />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-10 text-center">
          <p className="text-lg font-extrabold text-navy-700">No tests created yet.</p>
          <p className="mt-1 text-sm text-muted">Upload a PDF to create your first test.</p>
          <Link href="/admin/tests/from-pdf" className="mt-4 inline-block rounded-xl bg-crimson px-5 py-2.5 text-sm font-bold text-white">Create Test From PDF</Link>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-silver-200 bg-white shadow-card">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-silver-200 bg-silver-50 text-[11px] tracking-widest text-muted">
                <th className="px-4 py-3 font-bold">TEST NAME</th>
                <th className="px-4 py-3 font-bold">QUESTIONS</th>
                <th className="px-4 py-3 font-bold">DURATION</th>
                <th className="px-4 py-3 font-bold">STATUS</th>
                <th className="px-4 py-3 font-bold">DATE</th>
                <th className="px-4 py-3 text-right font-bold">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-silver-100 last:border-0 hover:bg-silver-50/60">
                  <td className="px-4 py-3">
                    <p className="font-extrabold text-navy-700">{t.title}</p>
                    <p className="text-[12px] text-muted">{t.type} • {t.batch?.name ?? "Open"}</p>
                  </td>
                  <td className="px-4 py-3 font-bold">{t._count?.questions ?? 0}</td>
                  <td className="px-4 py-3">{t.duration} min</td>
                  <td className="px-4 py-3"><TestStatusBadge status={badgeStatus(t.status)} /></td>
                  <td className="px-4 py-3 text-[12px] text-muted">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Link href={`/admin/tests/${t.id}/preview`} aria-label={`Preview ${t.title}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><Eye className="h-4 w-4" /></Link>
                      <Link href={`/admin/tests/${t.id}/configure`} aria-label={`Edit ${t.title}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><Pencil className="h-4 w-4" /></Link>
                      <button
                        onClick={() => void duplicate(t.id)}
                        disabled={busy === t.id}
                        aria-label={`Duplicate ${t.title}`}
                        className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500 disabled:opacity-50"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <Link href="/admin/results" aria-label={`Results for ${t.title}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><Megaphone className="h-4 w-4" /></Link>
                      <button
                        onClick={() => void remove(t.id, t.title)}
                        disabled={busy === t.id}
                        aria-label={`Delete ${t.title}`}
                        className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[12px] text-muted">Showing {filtered.length} of {tests.length} tests.</p>
    </AdminLayout>
  );
}
