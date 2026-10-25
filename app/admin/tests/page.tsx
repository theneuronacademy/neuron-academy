"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Upload, Database, BarChart3, Search, Eye, Pencil, Copy, Trash2, Megaphone } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { TestStatusBadge } from "@/components/admin/TestStatusBadge";
import { LoadingState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { useAdminAuth } from "@/hooks/useAdminAuth";
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
  const { ready: authReady, isAdmin } = useAdminAuth();
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
    if (!authReady || !isAdmin) return;
    setReady(true);
    void load();
  }, [router, authReady, isAdmin]);

  // Duplicate safely through the existing API: read the source test with
  // its questions, create a DRAFT copy, then copy questions one by one.
  async function duplicate(id: string) {
    setBusy(id);
    try {
      const [srcRes, qRes] = await Promise.all([
        fetch(`/api/tests/${id}`, { cache: "no-store" }),
        fetch(`/api/tests/${id}/questions`, { cache: "no-store" }),
      ]);
      const srcJson = await srcRes.json().catch(() => null);
      const qJson = await qRes.json().catch(() => null);
      if (!srcRes.ok || !srcJson?.success || !srcJson.data) throw new Error("Could not read source test.");
      const src = srcJson.data as ApiListTest & { questions?: any[] };
      const createRes = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: src.title,
          description: src.description,
          type: src.type,
          duration: src.duration,
          status: "DRAFT",
          batchId: src.batchId,
        }),
        cache: "no-store",
      });
      const createJson = await createRes.json().catch(() => null);
      if (!createRes.ok || !createJson?.success || !createJson.data) throw new Error(createJson?.error ?? "Duplicate failed.");
      const newId = String(createJson.data.id);
      const questions = (qJson?.success && Array.isArray(qJson.data?.items)) ? qJson.data.items : [];
      for (const q of questions) {
        await fetch(`/api/tests/${newId}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stem: q.stem,
            options: q.options,
            answerKey: q.answerKey,
            explanation: q.explanation,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            subject: q.subject,
            topic: q.topic,
            difficulty: q.difficulty,
            tags: q.tags,
          }),
          cache: "no-store",
        });
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duplicate failed.");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/tests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status.toUpperCase() }),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) throw new Error(json?.error ?? "Status change failed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status change failed.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this test permanently?")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/tests/${id}`, { method: "DELETE", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) throw new Error(json?.error ?? "Delete failed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  async function publishResults(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/tests/${id}/publish-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) throw new Error(json?.error ?? "Publish failed.");
      setSaved("Results published for this test.");
      setTimeout(() => setSaved(null), 3000);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setBusy(null);
    }
  }

  const filtered = tests.filter((t) => !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()));

  const [saved, setSaved] = useState<string | null>(null);

  if (!ready) {
    return (
      <AdminLayout title="Tests" subtitle="Academic → Tests">
        <LoadingState message="Loading tests…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Tests" subtitle={`${filtered.length} of ${tests.length} tests`}>
      <div className="flex flex-col gap-4">
        <div className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tests…"
                  className="w-72 pl-10 pr-4 py-2 rounded-xl border border-silver-300 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/tests/new">
                <Button variant="primary" size="sm"><Plus className="h-4 w-4 mr-2" /> Create Test</Button>
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-crimson-50 px-4 py-3 text-sm font-bold text-crimson" role="alert">{error}</p>
        )}
        {saved && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{saved}</p>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-card border border-silver-200 bg-white p-8 text-center shadow-card">
            <Database className="mx-auto h-12 w-12 text-muted" />
            <p className="mt-3 text-lg font-extrabold text-navy-700">No tests found</p>
            <p className="mt-1 text-muted">Create your first test or adjust the search.</p>
          </div>
        ) : (
          <div className="rounded-card border border-silver-200 bg-white shadow-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-silver-50 border-b border-silver-200">
                <tr>
                  <th className="px-4 py-3 font-extrabold text-navy-700">Test</th>
                  <th className="px-4 py-3 font-extrabold text-navy-700">Type</th>
                  <th className="px-4 py-3 font-extrabold text-navy-700">Duration</th>
                  <th className="px-4 py-3 font-extrabold text-navy-700">Batch</th>
                  <th className="px-4 py-3 font-extrabold text-navy-700">Questions</th>
                  <th className="px-4 py-3 font-extrabold text-navy-700">Status</th>
                  <th className="px-4 py-3 font-extrabold text-navy-700">Created</th>
                  <th className="px-4 py-3 font-extrabold text-navy-700 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-silver-100 hover:bg-silver-50">
                    <td className="px-4 py-3 font-bold text-navy-700">{t.title}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-widest bg-teal-50 text-teal-700">{t.type}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">{t.duration} min</td>
                    <td className="px-4 py-3 text-muted">{t.batch?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-bold text-navy-700">{t._count?.questions ?? 0}</td>
                    <td className="px-4 py-3"><TestStatusBadge status={badgeStatus(t.status)} /></td>
                    <td className="px-4 py-3 text-muted">{new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-3 text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/admin/tests/${t.id}/configure`}>
                          <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-silver-300 text-navy-700 hover:border-teal-500 sm:h-8 sm:w-8" aria-label={`Configure ${t.title}`}>
                            <Eye className="h-4 w-4" />
                          </button>
                        </Link>
                        <Link href={`/admin/tests/${t.id}/edit`}>
                          <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-silver-300 text-navy-700 hover:border-teal-500 sm:h-8 sm:w-8" aria-label={`Edit ${t.title}`}>
                            <Pencil className="h-4 w-4" />
                          </button>
                        </Link>
                        <button onClick={() => duplicate(t.id)} disabled={busy === t.id} className="flex h-10 w-10 items-center justify-center rounded-lg border border-silver-300 text-navy-700 hover:border-teal-500 sm:h-8 sm:w-8 disabled:opacity-50" aria-label={`Duplicate ${t.title}`}>
                          <Copy className="h-4 w-4" />
                        </button>
                        {t.status !== "PUBLISHED" && t.status !== "LIVE" && t.status !== "COMPLETED" ? (
                          <>
                            <button
                              onClick={() => setStatus(t.id, "PUBLISHED")}
                              disabled={busy === t.id}
                              className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[12px] font-bold text-teal-700 disabled:opacity-50"
                            >
                              Publish
                            </button>
                            <button
                              onClick={() => setStatus(t.id, "SCHEDULED")}
                              disabled={busy === t.id}
                              className="rounded-lg border border-silver-300 px-3 py-2 text-[12px] font-bold text-navy-700 disabled:opacity-50"
                            >
                              Schedule
                            </button>
                          </>
                        ) : null}
                        {t.status === "COMPLETED" && resultCount > 0 ? (
                          <button
                            onClick={() => publishResults(t.id)}
                            disabled={busy === t.id}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-700 disabled:opacity-50"
                          >
                            <Megaphone className="h-4 w-4 inline mr-1" /> Publish Results
                          </button>
                        ) : null}
                        <button onClick={() => remove(t.id)} disabled={busy === t.id} className="flex h-10 w-10 items-center justify-center rounded-lg border border-crimson-100 text-crimson hover:bg-crimson-50 sm:h-8 sm:w-8 disabled:opacity-50" aria-label={`Delete ${t.title}`}>
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
      </div>
    </AdminLayout>
  );
}