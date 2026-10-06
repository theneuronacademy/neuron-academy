"use client";

// C5 canonicalization — test configuration runs through PATCH /api/tests/[id].
// Editable here: name, description, duration, total marks, type and schedule.
// Question-pool generation lives on the server-native Generate page; the
// per-test question set is managed under Question Review.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { Button } from "@/components/ui/primitives";

const inputCls = "w-full rounded-xl border border-silver-300 bg-white px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";
const labelCls = "mb-1.5 block text-[12px] font-bold tracking-wide text-navy-700";

const TYPES = ["PRACTICE", "LIVE", "OFFLINE"] as const;

function toInputDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

export default function ConfigureTestPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const ready = useAdminGuard();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState(60);
  const [totalMarks, setTotalMarks] = useState(0);
  const [type, setType] = useState<string>("PRACTICE");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [questionCount, setQuestionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const res = await fetch(`/api/tests/${id}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const t = json?.success === true ? json.data?.item : null;
        if (!t) {
          setMissing(true);
          return;
        }
        setTitle(String(t.title ?? ""));
        setName(String(t.title ?? ""));
        setDesc(String(t.description ?? ""));
        setDuration(Number(t.duration ?? 60));
        setTotalMarks(Number(t.totalMarks ?? 0));
        setType(typeof t.type === "string" ? t.type : "PRACTICE");
        setStartAt(toInputDate(t.startTime ?? null));
        setEndAt(toInputDate(t.endTime ?? null));
        setQuestionCount(Array.isArray(t.questions) ? t.questions.length : Number(t.totalQuestions ?? 0));
      } catch {
        setMissing(true);
      } finally {
        setLoaded(true);
      }
    })();
  }, [ready, id]);

  async function save() {
    setError(null);
    try {
      const res = await fetch(`/api/tests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: name.trim() || title,
          description: desc,
          duration: Number(duration) || 60,
          totalMarks: Number(totalMarks) || 0,
          type,
          startTime: startAt || null,
          endTime: endAt || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setError(json?.error ?? "Save failed.");
        return;
      }
      router.push(`/admin/tests/${id}/preview`);
    } catch {
      setError("Cannot reach the server.");
    }
  }

  if (!ready || !loaded) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (missing) {
    return (
      <AdminLayout title="Configure Test">
        <p className="rounded-card bg-white p-6 text-sm font-bold text-muted">Test not found. <Link href="/admin/tests" className="text-teal-600 underline">Back</Link></p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Configure — ${title}`} subtitle={`${questionCount} questions in this test`}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3 rounded-card border border-silver-200 bg-white p-5 shadow-card">
          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          <div><label className={labelCls} htmlFor="cf-name">Test Name *</label><input id="cf-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className={labelCls} htmlFor="cf-desc">Description</label><textarea id="cf-desc" rows={2} className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls} htmlFor="cf-dur">Duration (minutes)</label><input id="cf-dur" type="number" min={1} className={inputCls} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
            <div><label className={labelCls} htmlFor="cf-tm">Total Marks</label><input id="cf-tm" type="number" min={0} className={inputCls} value={totalMarks} onChange={(e) => setTotalMarks(Number(e.target.value))} /></div>
          </div>
          <div>
            <label className={labelCls} htmlFor="cf-type">Type</label>
            <select id="cf-type" className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls} htmlFor="cf-start">Start (schedule)</label><input id="cf-start" type="datetime-local" className={inputCls} value={startAt} onChange={(e) => setStartAt(e.target.value)} /></div>
            <div><label className={labelCls} htmlFor="cf-end">End (schedule)</label><input id="cf-end" type="datetime-local" className={inputCls} value={endAt} onChange={(e) => setEndAt(e.target.value)} /></div>
          </div>
        </div>

        <div className="h-fit rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className={labelCls}>Questions</p>
          <p className="text-sm text-muted">{questionCount} question(s) attached. Manage them under Question Review; generate pool-based sets on the Generate page.</p>
          <div className="mt-3 grid gap-2">
            <Link href={`/admin/tests/${id}/questions`} className="rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-navy-800">Manage Questions →</Link>
            <Link href="/admin/tests/generate" className="rounded-xl border border-silver-300 px-4 py-2.5 text-center text-sm font-bold text-navy-700">Generate From Pool →</Link>
          </div>
          <Button onClick={() => void save()} size="lg" className="mt-4 w-full">Save & Preview →</Button>
          <Link href={`/admin/tests/${id}/questions`} className="mt-2 block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Question Review</Link>
        </div>
      </div>
    </AdminLayout>
  );
}
