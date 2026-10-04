"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { Button } from "@/components/ui/primitives";
import { getQuestionById, updateTest } from "@/lib/storage";
import { getTestById, publishTest } from "@/services/testService";
import { cn } from "@/lib/utils";

export default function TestPreviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const ready = useAdminGuard();
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  const test = getTestById(id);
  if (!test) {
    return (
      <AdminLayout title="Preview">
        <p className="rounded-card bg-white p-6 text-sm font-bold text-muted">Test not found. <Link href="/admin/tests" className="text-teal-600 underline">Back</Link></p>
      </AdminLayout>
    );
  }
  const questions = test.questionIds.map((qid) => getQuestionById(qid)).filter((q) => q !== null);
  const q = questions[idx];

  return (
    <AdminLayout title={`Preview — ${test.name}`} subtitle="Exact student experience • read-only rehearsal">
      {done ? <p className="mb-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-700" role="status">{done}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-silver-200 pb-3">
            <p className="text-sm font-extrabold text-navy-700">{test.name}</p>
            <p className="text-[12px] font-bold text-muted">{test.durationMinutes} min • {questions.length} Qs • {test.marksPerQuestion} marks each</p>
          </div>
          {!q ? (
            <p className="py-8 text-center text-sm font-bold text-muted">No questions in this test yet. <Link href={`/admin/tests/${id}/configure`} className="text-teal-600 underline">Configure</Link></p>
          ) : (
            <div className="mt-4">
              <p className="text-[12px] font-bold text-muted">Question {idx + 1} of {questions.length}</p>
              <h3 className="mt-1 text-[16px] font-extrabold leading-snug text-ink">{q.question}</h3>
              <div className="mt-3 grid gap-2">
                {q.options.map((o, i) => (
                  <button
                    key={i}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                    className={cn("rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition", answers[q.id] === i ? "border-teal-500 bg-teal-50 text-navy-700" : "border-silver-200 bg-white hover:border-teal-400")}
                    aria-pressed={answers[q.id] === i}
                  >
                    <span className="mr-2 font-extrabold">{"ABCD"[i]}.</span>{o}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex justify-between">
                <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="inline-flex items-center gap-1 rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button>
                <button disabled={idx === questions.length - 1} onClick={() => setIdx(idx + 1)} className="inline-flex items-center gap-1 rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
            <p className="text-[12px] font-extrabold text-navy-700">Question Palette (preview)</p>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {questions.map((qq, i) => (
                <button key={qq.id} onClick={() => setIdx(i)} aria-label={`Go to question ${i + 1}`} className={cn("rounded-lg py-1.5 text-[12px] font-bold", i === idx ? "bg-navy-700 text-white" : answers[qq.id] !== undefined ? "bg-teal-500 text-white" : "bg-silver-100 text-muted")}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 rounded-card bg-navy-800 p-4">
            <Button variant="secondary" onClick={() => setConfirm(true)}>Publish Test</Button>
            <button
              onClick={() => {
                updateTest(id, { status: "draft" });
                setDone("Saved as draft.");
              }}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
            >
              Save Draft
            </button>
            <Link href={`/admin/tests/${id}/configure`} className="rounded-xl border border-white/20 px-4 py-2.5 text-center text-sm font-bold text-silver-200 hover:text-white">Back to Configure</Link>
          </div>
        </div>
      </div>

      {confirm ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-800/60 p-4" role="dialog" aria-modal="true" aria-label="Publish test">
          <div className="w-full max-w-sm rounded-card bg-white p-6 text-center">
            <p className="text-lg font-extrabold text-navy-700">Publish this test to students?</p>
            <p className="mt-1 text-sm text-muted">{questions.length} questions • {test.durationMinutes} min • students see it instantly.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirm(false)} className="rounded-xl border border-silver-300 px-4 py-2.5 text-sm font-bold">Cancel</button>
              <button
                onClick={() => {
                  publishTest(id);
                  setConfirm(false);
                  setDone("Test published — students can now attempt it.");
                  setTimeout(() => router.push("/admin/tests"), 1200);
                }}
                className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
