"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Flag, Timer } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { draftKey, getQuestionById, getResultFor } from "@/lib/storage";
import { getTestById } from "@/services/testService";
import { evaluateTest, formatTime } from "@/services/resultService";
import { startAttempt, submitAttempt } from "@/services/testApi";
import { cn } from "@/lib/utils";

type Phase = "instructions" | "attempt";

export default function StudentTestAttemptPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const session = useStudentGuard();
  const [phase, setPhase] = useState<Phase>("instructions");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [marked, setMarked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [expired, setExpired] = useState(false);
  const startRef = useRef<number>(Date.now());
  const submittedRef = useRef(false);
  // Phase 5: server attempt id when the database is live (null in demo mode).
  const serverAttemptRef = useRef<string | null>(null);

  const test = getTestById(id);
  const questions = useMemo(
    () => (test ? test.questionIds.map((qid) => getQuestionById(qid)).filter((q) => q !== null) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [test?.id, test?.updatedAt]
  );
  const totalSec = (test?.durationMinutes ?? 20) * 60;
  const [left, setLeft] = useState(totalSec);

  // Restore draft answers (per student+test).
  useEffect(() => {
    if (!session || !test || phase !== "attempt") return;
    try {
      const raw = window.localStorage.getItem(draftKey(test.id, session.studentId));
      if (raw) {
        const d = JSON.parse(raw) as { answers?: Record<string, number | null>; startedAt?: number };
        if (d.answers) setAnswers(d.answers);
        if (d.startedAt) startRef.current = d.startedAt;
      } else {
        startRef.current = Date.now();
      }
    } catch {
      /* ignore */
    }
    // Phase 5: open a server-side attempt when the database is live.
    // Fire-and-forget — local engine stays authoritative in demo mode.
    try {
      void startAttempt(test.id).then((r) => {
        if (r.ok && r.attemptId) serverAttemptRef.current = r.attemptId;
      });
    } catch {
      /* demo mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Persist draft during attempt.
  useEffect(() => {
    if (!session || !test || phase !== "attempt") return;
    try {
      window.localStorage.setItem(draftKey(test.id, session.studentId), JSON.stringify({ answers, startedAt: startRef.current }));
    } catch {
      /* ignore */
    }
  }, [answers, phase, session, test]);

  const doSubmit = (auto = false) => {
    if (!session || !test || submittedRef.current) return;
    submittedRef.current = true;
    const taken = Math.min(totalSec, Math.floor((Date.now() - startRef.current) / 1000));
    evaluateTest(test, questions, answers, taken, { studentId: session.studentId, studentName: session.name });
    // Phase 5: mirror to the server when live (server re-evaluates; never trusts this client).
    // Fire-and-forget — local result page always renders from the local engine.
    try {
      void submitAttempt(test.id, serverAttemptRef.current, answers).catch(() => null);
    } catch {
      /* demo mode */
    }
    if (auto) setExpired(true);
    router.push(`/student/tests/${test.id}/result`);
  };

  // Countdown + auto-submit.
  useEffect(() => {
    if (phase !== "attempt" || !test) return;
    setLeft(totalSec);
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const remain = totalSec - elapsed;
      if (remain <= 0) {
        clearInterval(t);
        setLeft(0);
        doSubmit(true);
      } else {
        setLeft(remain);
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, test?.id]);

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (!test) {
    return (
      <StudentShell title="Test">
        <p className="rounded-card bg-white p-6 text-sm font-bold text-muted">Test not found. <Link href="/student/tests" className="text-teal-600 underline">Back</Link></p>
      </StudentShell>
    );
  }
  const existing = getResultFor(test.id, session.studentId);
  if (existing) {
    return (
      <StudentShell title={test.name} subtitle="Already attempted">
        <div className="rounded-card border border-silver-200 bg-white p-6 text-center shadow-card">
          <p className="text-lg font-extrabold text-navy-700">You already submitted this test.</p>
          <p className="mt-1 text-sm text-muted">Score: {existing.marks}/{existing.maxMarks} ({existing.percentage}%)</p>
          <Link href={`/student/tests/${test.id}/result`} className="mt-4 inline-block rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white">View Result</Link>
        </div>
      </StudentShell>
    );
  }

  if (phase === "instructions") {
    return (
      <StudentShell title={test.name} subtitle={`${questions.length} questions • ${test.durationMinutes} minutes`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6">
            <h2 className="text-[15px] font-extrabold text-navy-700">Instructions</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13.5px] text-ink">
              <li>{test.marksPerQuestion} mark(s) per question{test.negativeMarks > 0 ? `, −${test.negativeMarks} for every wrong answer` : ", no negative marking"}.</li>
              <li>Timer auto-submits when it reaches 00:00.</li>
              <li>Use the palette: white = not visited, navy = visited, teal = answered, amber = marked.</li>
              <li>Questions without verified answers are sent for faculty review, not auto-scored.</li>
            </ul>
            <p className="mt-3 text-[13px] text-muted">{test.description}</p>
          </div>
          <div className="rounded-card bg-navy-800 p-5 text-white sm:p-6">
            <p className="text-sm font-extrabold">Ready?</p>
            <p className="mt-1 text-[13px] text-silver-200">{questions.length} questions • {formatTime(totalSec)} on the clock.</p>
            <button onClick={() => setPhase("attempt")} className="btn-metallic-sheen mt-4 w-full rounded-xl bg-crimson-DEFAULT px-5 py-3 text-sm font-bold hover:bg-crimson-bright">
              Start Test
            </button>
            <Link href="/student/tests" className="mt-2 block text-center text-[13px] font-bold text-silver-200 hover:text-white">← Back to tests</Link>
          </div>
        </div>
      </StudentShell>
    );
  }

  const q = questions[idx];
  const answered = Object.values(answers).filter((a) => a !== null && a !== undefined).length;
  const unanswered = questions.length - answered;
  const markedCount = marked.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 border-b border-silver-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <p className="text-sm font-extrabold text-navy-700">{test.name} <span className="font-semibold text-muted">• Q{idx + 1}/{questions.length}</span></p>
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-extrabold", left < 60 ? "bg-crimson-50 text-crimson-DEFAULT" : "bg-navy-800 text-white")}>
              <Timer className="h-4 w-4" /> {formatTime(left)}
            </span>
            <button onClick={() => setConfirm(true)} className="rounded-xl bg-teal-600 px-4 py-1.5 text-sm font-bold text-white">Submit</button>
          </div>
        </div>
        <div className="h-1 bg-silver-200">
          <div className="h-full bg-teal-500 transition-all" style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }} />
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_250px]">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6">
          {!q ? (
            <p className="text-sm font-bold text-muted">No questions in this test.</p>
          ) : (
            <>
              <p className="text-[12px] font-bold text-muted">Question {idx + 1} • {q.marks} marks{q.negativeMarks ? ` • −${q.negativeMarks} negative` : ""}</p>
              <h2 className="mt-1 text-[16px] font-extrabold leading-snug text-ink">{q.question}</h2>
              {q.containsImage && !q.imageUrl ? <p className="mt-1 text-[12px] font-bold text-muted">🖼 Question image detected (image extraction lands here in production).</p> : null}
              {q.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.imageUrl} alt="Question figure" className="mt-2 max-h-56 rounded-xl border border-silver-200 object-contain" />
              ) : null}
              <div className="mt-4 grid gap-2">
                {q.options.map((o, i) => (
                  <button
                    key={i}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                    className={cn("rounded-xl border px-4 py-3 text-left text-sm font-semibold transition", answers[q.id] === i ? "border-teal-500 bg-teal-50 text-navy-700 ring-2 ring-teal-500/20" : "border-silver-200 hover:border-teal-400")}
                    aria-pressed={answers[q.id] === i}
                  >
                    <span className="mr-2 font-extrabold">{"ABCD"[i]}.</span>{o}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="inline-flex items-center gap-1 rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button>
                <button
                  onClick={() => setMarked((m) => (m.includes(q.id) ? m.filter((x) => x !== q.id) : [...m, q.id]))}
                  className={cn("inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-bold", marked.includes(q.id) ? "border-amber-500 bg-amber-50 text-amber-700" : "border-silver-300")}
                  aria-pressed={marked.includes(q.id)}
                >
                  <Flag className="h-4 w-4" /> {marked.includes(q.id) ? "Unmark" : "Mark for Review"}
                </button>
                <button onClick={() => setAnswers((a) => ({ ...a, [q.id]: null }))} className="rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold text-muted">Clear Response</button>
                <button disabled={idx === questions.length - 1} onClick={() => setIdx(idx + 1)} className="inline-flex items-center gap-1 rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button>
              </div>
            </>
          )}
        </div>

        <aside className="h-fit rounded-card border border-silver-200 bg-white p-4 shadow-card">
          <p className="text-[12px] font-extrabold text-navy-700">Question Palette</p>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {questions.map((qq, i) => {
              const a = answers[qq.id];
              const m = marked.includes(qq.id);
              return (
                <button
                  key={qq.id}
                  onClick={() => setIdx(i)}
                  aria-label={`Question ${i + 1}${a !== null && a !== undefined ? ", answered" : ""}${m ? ", marked" : ""}`}
                  className={cn(
                    "rounded-lg py-1.5 text-[12px] font-bold",
                    i === idx ? "ring-2 ring-navy-700 " : "",
                    a !== null && a !== undefined ? (m ? "bg-teal-500 text-white ring-2 ring-amber-400" : "bg-teal-500 text-white") : m ? "bg-amber-400 text-navy-800" : i < idx ? "bg-navy-700 text-white" : "bg-silver-100 text-muted"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-3 space-y-1 text-[11px] font-bold text-muted">
            <p><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-teal-500" /> Answered ({answered})</p>
            <p><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-navy-700" /> Visited</p>
            <p><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-silver-200" /> Not Visited</p>
            <p><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-amber-400" /> Marked ({markedCount})</p>
          </div>
          <button onClick={() => setConfirm(true)} className="mt-3 w-full rounded-xl bg-crimson-DEFAULT px-4 py-2.5 text-sm font-bold text-white">Submit Test</button>
        </aside>
      </main>

      {expired ? <p className="sr-only" role="alert">Time is over. Your test has been submitted.</p> : null}

      {confirm ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-800/60 p-4" role="dialog" aria-modal="true" aria-label="Confirm submission">
          <div className="w-full max-w-sm rounded-card bg-white p-6 text-center">
            <p className="text-lg font-extrabold text-navy-700">Submit test?</p>
            <p className="mt-2 text-sm text-muted">Answered: <b>{answered}</b> • Unanswered: <b>{unanswered}</b> • Marked: <b>{markedCount}</b></p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirm(false)} className="rounded-xl border border-silver-300 px-4 py-2.5 text-sm font-bold">Cancel</button>
              <button onClick={() => doSubmit(false)} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white">Confirm Submit</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
