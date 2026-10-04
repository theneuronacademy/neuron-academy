"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Upload, Database, BarChart3, Search, Eye, Pencil, Copy, Trash2, Megaphone } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { TestStatusBadge } from "@/components/admin/TestStatusBadge";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getQuestions, getResults, getTests } from "@/lib/storage";
import { deriveStatus } from "@/services/testService";
import { duplicateTest } from "@/services/testService";
import { deleteTest } from "@/lib/storage";

export default function AdminTestsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    setReady(true);
    const onUpd = () => setTick((t) => t + 1);
    window.addEventListener("neuron-test-updated", onUpd);
    return () => window.removeEventListener("neuron-test-updated", onUpd);
  }, [router]);

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading tests…</div>;

  const tests = getTests();
  const questions = getQuestions();
  const results = getResults();
  const withDerived = tests.map((t) => ({ ...t, live: deriveStatus(t) }));
  const count = (s: string) => withDerived.filter((t) => (s === "all" ? true : t.live === s || t.status === s)).length;
  const filtered = withDerived.filter((t) => !search.trim() || `${t.name} ${t.subject} ${t.chapter}`.toLowerCase().includes(search.toLowerCase()));

  const stats = [
    { label: "Total Tests", value: tests.length },
    { label: "Draft Tests", value: withDerived.filter((t) => t.status === "draft").length },
    { label: "Scheduled", value: withDerived.filter((t) => t.live === "scheduled").length },
    { label: "Live / Published", value: withDerived.filter((t) => ["published", "live"].includes(t.live)).length },
    { label: "Completed", value: withDerived.filter((t) => t.live === "completed").length },
    { label: "Total Questions", value: questions.length },
  ];

  return (
    <AdminLayout title="Tests" subtitle="PDF → questions → test → student result">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
            <p className="text-[11px] font-bold tracking-widest text-muted">{s.label.toUpperCase()}</p>
            <p className="mt-1 text-3xl font-extrabold text-navy-700">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 rounded-card bg-navy-800 p-5 text-white sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/tests/new" className="rounded-xl bg-crimson-DEFAULT px-4 py-2.5 text-center text-sm font-bold hover:bg-crimson-bright">
          <Plus className="mr-1 inline h-4 w-4" />Create Test
        </Link>
        <Link href="/admin/tests/from-pdf" className="rounded-xl bg-teal-500 px-4 py-2.5 text-center text-sm font-bold hover:bg-teal-400">
          <Upload className="mr-1 inline h-4 w-4" />Upload PDF
        </Link>
        <Link href="/admin/question-bank" className="rounded-xl bg-white/10 px-4 py-2.5 text-center text-sm font-bold ring-1 ring-white/20 hover:bg-white/20">
          <Database className="mr-1 inline h-4 w-4" />Question Bank
        </Link>
        <Link href="/admin/results" className="rounded-xl bg-white/10 px-4 py-2.5 text-center text-sm font-bold ring-1 ring-white/20 hover:bg-white/20">
          <BarChart3 className="mr-1 inline h-4 w-4" />View Results ({results.length})
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-navy-700">Recent Tests {tick > 0 ? "" : ""}</h2>
        <label className="flex items-center gap-2 rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tests…" aria-label="Search tests" className="bg-transparent outline-none" />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-10 text-center">
          <p className="text-lg font-extrabold text-navy-700">No tests created yet.</p>
          <p className="mt-1 text-sm text-muted">Upload a PDF to create your first test.</p>
          <Link href="/admin/tests/from-pdf" className="mt-4 inline-block rounded-xl bg-crimson-DEFAULT px-5 py-2.5 text-sm font-bold text-white">Create Test From PDF</Link>
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
                    <p className="font-extrabold text-navy-700">{t.name}</p>
                    <p className="text-[12px] text-muted">{t.subject} • {t.chapter} • by {t.createdBy}</p>
                  </td>
                  <td className="px-4 py-3 font-bold">{t.questionIds.length}</td>
                  <td className="px-4 py-3">{t.durationMinutes} min</td>
                  <td className="px-4 py-3"><TestStatusBadge status={deriveStatus(t)} /></td>
                  <td className="px-4 py-3 text-[12px] text-muted">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Link href={`/admin/tests/${t.id}/preview`} aria-label={`Preview ${t.name}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><Eye className="h-4 w-4" /></Link>
                      <Link href={`/admin/tests/${t.id}/configure`} aria-label={`Edit ${t.name}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><Pencil className="h-4 w-4" /></Link>
                      <button
                        onClick={() => {
                          duplicateTest(t.id);
                          setTick((x) => x + 1);
                        }}
                        aria-label={`Duplicate ${t.name}`}
                        className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <Link href="/admin/results" aria-label={`Results for ${t.name}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><Megaphone className="h-4 w-4" /></Link>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete "${t.name}"? Questions stay in the bank.`)) {
                            deleteTest(t.id);
                            setTick((x) => x + 1);
                          }
                        }}
                        aria-label={`Delete ${t.name}`}
                        className="rounded-lg border border-crimson-100 p-2 text-crimson-DEFAULT hover:bg-crimson-50"
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
      <p className="mt-3 text-[12px] text-muted">Showing {filtered.length} of {tests.length} tests • {count("x") === 0 ? "" : ""}Statuses derive from schedule dates where set.</p>
    </AdminLayout>
  );
}
