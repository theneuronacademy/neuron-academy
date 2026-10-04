"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { Button } from "@/components/ui/primitives";
import { getQuestions, updateTest } from "@/lib/storage";
import { availableForTest, selectQuestions } from "@/services/questionService";
import { getTestById } from "@/services/testService";

const inputCls = "w-full rounded-xl border border-silver-300 bg-white px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";
const labelCls = "mb-1.5 block text-[12px] font-bold tracking-wide text-navy-700";

export default function ConfigureTestPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const ready = useAdminGuard();
  const router = useRouter();
  const test = getTestById(id);

  const bank = useMemo(() => getQuestions(), []);
  const [name, setName] = useState(test?.name ?? "Percentage Practice Test");
  const [desc, setDesc] = useState(test?.description ?? "");
  const [subject, setSubject] = useState(test?.subject ?? "Quantitative Aptitude");
  const [chapter, setChapter] = useState(test?.chapter ?? "Percentage");
  const [count, setCount] = useState(test?.questionIds.length || 10);
  const [duration, setDuration] = useState(test?.durationMinutes ?? 20);
  const [marks, setMarks] = useState(test?.marksPerQuestion ?? 2);
  const [neg, setNeg] = useState(test?.negativeMarks ?? 0.5);
  const [difficulty, setDifficulty] = useState(test?.difficulty ?? "Mixed");
  const [mode, setMode] = useState<"all" | "random" | "manual">("all");
  const [manual, setManual] = useState<string[]>(test?.questionIds ?? []);
  const [startAt, setStartAt] = useState(test?.startAt ?? "");
  const [endAt, setEndAt] = useState(test?.endAt ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (!test) {
    return (
      <AdminLayout title="Configure Test">
        <p className="rounded-card bg-white p-6 text-sm font-bold text-muted">Test not found. <Link href="/admin/tests" className="text-teal-600 underline">Back</Link></p>
      </AdminLayout>
    );
  }

  const pool = availableForTest(bank);
  const byDiff = difficulty === "Mixed" ? pool : pool.filter((q) => q.difficulty === difficulty);

  const generate = () => {
    let ids: string[];
    if (mode === "all") ids = byDiff.slice(0, count).map((q) => q.id);
    else if (mode === "random") ids = selectQuestions(byDiff, count, "random").map((q) => q.id);
    else ids = manual.slice(0, count);
    if (ids.length === 0) {
      setError("No approved questions available for this selection. Approve questions first (Question Review) — missing-answer questions are excluded.");
      return;
    }
    if (ids.length < count) {
      setError(`Only ${ids.length} approved questions available (asked ${count}). Using all available — approve more in Question Review.`);
    }
    updateTest(id, {
      name: name.trim() || test.name,
      description: desc,
      subject,
      chapter,
      questionIds: ids,
      durationMinutes: duration,
      marksPerQuestion: marks,
      negativeMarks: neg,
      difficulty,
      startAt,
      endAt,
    });
    router.push(`/admin/tests/${id}/preview`);
  };

  return (
    <AdminLayout title={`Configure — ${test.name}`} subtitle={`${pool.length} approved questions available in bank`}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3 rounded-card border border-silver-200 bg-white p-5 shadow-card">
          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson-DEFAULT" role="alert">{error}</p> : null}
          <div><label className={labelCls} htmlFor="cf-name">Test Name *</label><input id="cf-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className={labelCls} htmlFor="cf-desc">Description</label><textarea id="cf-desc" rows={2} className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls} htmlFor="cf-sub">Subject</label><input id="cf-sub" className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div><label className={labelCls} htmlFor="cf-ch">Chapter</label><input id="cf-ch" className={inputCls} value={chapter} onChange={(e) => setChapter(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls} htmlFor="cf-count">Number of Questions</label><input id="cf-count" type="number" min={1} max={100} className={inputCls} value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
            <div><label className={labelCls} htmlFor="cf-dur">Duration (minutes)</label><input id="cf-dur" type="number" min={1} className={inputCls} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls} htmlFor="cf-marks">Marks / Q</label><input id="cf-marks" type="number" step="0.5" min={0} className={inputCls} value={marks} onChange={(e) => setMarks(Number(e.target.value))} /></div>
            <div><label className={labelCls} htmlFor="cf-neg">Negative</label><input id="cf-neg" type="number" step="0.25" min={0} className={inputCls} value={neg} onChange={(e) => setNeg(Number(e.target.value))} /></div>
            <div>
              <label className={labelCls} htmlFor="cf-diff">Difficulty</label>
              <select id="cf-diff" className={inputCls} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option>Mixed</option><option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls} htmlFor="cf-start">Start (schedule)</label><input id="cf-start" type="datetime-local" className={inputCls} value={startAt} onChange={(e) => setStartAt(e.target.value)} /></div>
            <div><label className={labelCls} htmlFor="cf-end">End (schedule)</label><input id="cf-end" type="datetime-local" className={inputCls} value={endAt} onChange={(e) => setEndAt(e.target.value)} /></div>
          </div>
        </div>

        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className={labelCls}>Question Selection</p>
          <div className="grid grid-cols-3 gap-2">
            {(["all", "random", "manual"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-xl px-3 py-2 text-[13px] font-bold capitalize ${mode === m ? "bg-navy-700 text-white" : "border border-silver-300 text-navy-700"}`}>
                {m === "all" ? "Use all" : m}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">
            {mode === "all" && `First ${count} approved${difficulty !== "Mixed" ? ` • ${difficulty}` : ""} questions.`}
            {mode === "random" && `Random ${count} (no duplicates) via shuffled selection.`}
            {mode === "manual" && `Tick exactly which questions to include (${manual.length} selected).`}
          </p>
          {mode === "manual" ? (
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
              {pool.slice(0, 40).map((q) => (
                <label key={q.id} className="flex items-start gap-2 rounded-xl border border-silver-200 px-3 py-2 text-[13px]">
                  <input type="checkbox" checked={manual.includes(q.id)} onChange={() => setManual((m) => (m.includes(q.id) ? m.filter((x) => x !== q.id) : [...m, q.id]))} className="mt-0.5 h-4 w-4 accent-[#008C9E]" />
                  <span className="font-semibold">{q.question.slice(0, 90)}{q.question.length > 90 ? "…" : ""} <span className="text-muted">({q.difficulty})</span></span>
                </label>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-silver-50 p-4 text-sm">
              <p className="font-extrabold text-navy-700">{byDiff.length} eligible • will use {Math.min(count, byDiff.length)}</p>
              <p className="text-[12px] text-muted">Only approved questions with verified answers and 4 filled options are eligible.</p>
            </div>
          )}
          <Button onClick={generate} size="lg" className="mt-4 w-full">Generate Test →</Button>
          <Link href={`/admin/tests/${id}/questions`} className="mt-2 block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Question Review</Link>
        </div>
      </div>
    </AdminLayout>
  );
}
