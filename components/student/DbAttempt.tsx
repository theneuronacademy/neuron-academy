"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Flag, Loader2, Lock, Timer } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { cn } from "@/lib/utils";

interface DbMeta {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  accessType: "FREE" | "PAID" | "PRIVATE";
  price: number;
}

interface PaperQ {
  id: string;
  questionText: string;
  options: { display: string; text: string | null }[];
  marks: number;
  negativeMarks: number;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Phase 13 — API-backed attempt for database tests (FREE/PAID/PRIVATE). */
export function DbAttempt({ testId }: { testId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "instructions" | "attempt" | "locked" | "missing" | "done">("loading");
  const [meta, setMeta] = useState<DbMeta | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [paper, setPaper] = useState<PaperQ[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [marked, setMarked] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalSec, setTotalSec] = useState(1200);
  const [left, setLeft] = useState(1200);
  const startRef = useRef(Date.now());
  const submittedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/tests/${encodeURIComponent(testId)}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.status === 403) {
          setLockReason(json?.error ?? "This test is locked.");
          setPhase("locked");
          return;
        }
        if (!res.ok || json?.success !== true) {
          setPhase("missing");
          return;
        }
        const t = json.data.item;
        setMeta({
          id: String(t.id),
          title: String(t.title),
          description: t.description ?? null,
          duration: Number(t.duration ?? 60),
          accessType: t.accessType ?? "FREE",
          price: Number(t.price ?? 0),
        });
        setTotalSec(Number(t.duration ?? 60) * 60);
        setLeft(Number(t.duration ?? 60) * 60);
        setPhase("instructions");
      } catch {
        setPhase("missing");
      }
    })();
  }, [testId]);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const aRes = await fetch(`/api/tests/${encodeURIComponent(testId)}/attempt`, { method: "POST" });
      const aJson = await aRes.json().catch(() => null);
      if (aRes.status === 403 || aRes.status === 410) {
        setLockReason(aJson?.error ?? "This test is locked.");
        setPhase("locked");
        return;
      }
      if (!aRes.ok || aJson?.success !== true) {
        setError(aJson?.error ?? "Could not start the test.");
        return;
      }
      const aid = String(aJson.data.attempt.id);
      setAttemptId(aid);
      const qRes = await fetch(`/api/questions?testId=${encodeURIComponent(testId)}&attemptId=${encodeURIComponent(aid)}`, { cache: "no-store" });
      const qJson = await qRes.json().catch(() => null);
      if (!qRes.ok || qJson?.success !== true || !Array.isArray(qJson.data?.items)) {
        setError(qJson?.error ?? "Could not load questions.");
        return;
      }
      setPaper(qJson.data.items as PaperQ[]);
      startRef.current = Date.now();
      setPhase("attempt");
    } catch {
      setError("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function doSubmit() {
    if (submittedRef.current || !attemptId) return;
    submittedRef.current = true;
    setBusy(true);
    try {
      const res = await fetch(`/api/tests/${encodeURIComponent(testId)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, answers }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setError(json?.error ?? "Submission failed.");
        submittedRef.current = false;
        setBusy(false);
        return;
      }
      setPhase("done");
      router.push(`/student/tests/${testId}/result`);
    } catch {
      setError("Cannot reach the server.");
      submittedRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (phase !== "attempt") return;
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const remain = totalSec - elapsed;
      if (remain <= 0) {
        clearInterval(t);
        setLeft(0);
        void doSubmit();
      } else {
        setLeft(remain);
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "loading") {
    return (
      <StudentShell title="Test">
        <p className="rounded-card bg-white p-8 text-center text-sm font-bold text-muted">Loading test…</p>
      </StudentShell>
    );
  }

  if (phase === "locked") {
    return (
      <StudentShell title="Locked Test" subtitle="Access required">
        <div className="mx-auto max-w-md rounded-card border border-silver-200 bg-white p-6 text-center shadow-card">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-silver-100 text-muted"><Lock className="h-6 w-6" /></span>
          <p className="mt-3 text-lg font-extrabold text-navy-700">This test is locked</p>
          <p className="mt-1 text-sm text-muted">{lockReason}</p>
          <Link href="/student/tests" className="mt-4 inline-block rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white">Back to Tests</Link>
        </div>
      </StudentShell>
    );
  }

  if (phase === "missing" || !meta) {
    return (
      <StudentShell title="Test">
        <p className="rounded-card bg-white p-6 text-sm font-bold text-muted">Test not found. <Link href="/student/tests" className="text-teal-600 underline">Back</Link></p>
      </StudentShell>
    );
  }

  if (phase === "instructions") {
    return (
      <StudentShell title={meta.title} subtitle={`${meta.accessType === "PAID" ? `₹${meta.price} • ` : meta.accessType === "PRIVATE" ? "Private • " : "FREE • "}Online test`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6">
            <h2 className="text-[15px] font-extrabold text-navy-700">Instructions</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13.5px] text-ink">
              <li>Timer auto-submits when it reaches 00:00.</li>
              <li>Use the palette: white = not visited, navy = visited, teal = answered, amber = marked.</li>
              <li>Evaluated on the server — your answers are saved per question.</li>
            </ul>
            {meta.description ? <p className="mt-3 text-[13px] text-muted">{meta.description}</p> : null}
            {error ? <p className="mt-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          </div>
          <div className="rounded-card bg-navy-800 p-5 text-white sm:p-6">
            <p className="text-sm font-extrabold">Ready?</p>
            <p className="mt-1 text-[13px] text-silver-200">{meta.duration} minutes on the clock.</p>
            <button onClick={() => void begin()} disabled={busy} className="btn-metallic-sheen mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-crimson px-5 py-3 text-sm font-bold hover:bg-crimson-bright disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {busy ? "Starting…" : "Start Test"}
            </button>
            <Link href="/student/tests" className="mt-2 block text-center text-[13px] font-bold text-silver-200 hover:text-white">← Back to tests</Link>
          </div>
        </div>
      </StudentShell>
    );
  }

  if (phase === "done") {
    return (
      <StudentShell title="Submitted">
        <p className="rounded-card bg-white p-8 text-center text-sm font-bold text-muted">Submitted — opening your result…</p>
      </StudentShell>
    );
  }

  const q = paper[idx];
  const answered = Object.values(answers).filter((a) => a !== null && a !== undefined).length;
  const unanswered = paper.length - answered;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 border-b border-silver-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <p className="text-sm font-extrabold text-navy-700">{meta.title} <span className="font-semibold text-muted">• Q{idx + 1}/{paper.length}</span></p>
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-extrabold", left < 60 ? "bg-crimson-50 text-crimson" : "bg-navy-800 text-white")}>
              <Timer className="h-4 w-4" /> {fmt(left)}
            </span>
            <button onClick={() => setConfirm(true)} className="rounded-xl bg-teal-600 px-4 py-1.5 text-sm font-bold text-white">Submit</button>
          </div>
        </div>
        <div className="h-1 bg-silver-200">
          <div className="h-full bg-teal-500 transition-all" style={{ width: `${paper.length ? (answered / paper.length) * 100 : 0}%` }} />
        </div>
      </div>
      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_250px]">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6">
          {error ? <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          {!q ? (
            <p className="text-sm font-bold text-muted">No questions in this test.</p>
          ) : (
            <>
              <p className="text-[12px] font-bold text-muted">Question {idx + 1} • {q.marks} marks{q.negativeMarks ? ` • −${q.negativeMarks} negative` : ""}</p>
              <h2 className="mt-1 text-[16px] font-extrabold leading-snug text-ink">{q.questionText}</h2>
              <div className="mt-4 grid gap-2">
                {q.options.map((o) => (
                  <button
                    key={o.display}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.display }))}
                    className={cn("rounded-xl border px-4 py-3 text-left text-sm font-semibold transition", answers[q.id] === o.display ? "border-teal-500 bg-teal-50 text-navy-700 ring-2 ring-teal-500/20" : "border-silver-200 hover:border-teal-400")}
                    aria-pressed={answers[q.id] === o.display}
                  >
                    <span className="mr-2 font-extrabold">{o.display}.</span>{o.text ?? <span className="text-muted">(empty)</span>}
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
                <button disabled={idx === paper.length - 1} onClick={() => setIdx(idx + 1)} className="inline-flex items-center gap-1 rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button>
              </div>
            </>
          )}
        </div>
        <aside className="h-fit rounded-card border border-silver-200 bg-white p-4 shadow-card">
          <p className="text-[12px] font-extrabold text-navy-700">Question Palette</p>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {paper.map((qq, i) => {
              const a = answers[qq.id];
              const m = marked.includes(qq.id);
              return (
                <button
                  key={qq.id}
                  onClick={() => setIdx(i)}
                  aria-label={`Question ${i + 1}${a ? ", answered" : ""}${m ? ", marked" : ""}`}
                  className={cn(
                    "rounded-lg py-1.5 text-[12px] font-bold",
                    i === idx ? "ring-2 ring-navy-700 " : "",
                    a ? (m ? "bg-teal-500 text-white ring-2 ring-amber-400" : "bg-teal-500 text-white") : m ? "bg-amber-400 text-navy-800" : i < idx ? "bg-navy-700 text-white" : "bg-silver-100 text-muted"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button onClick={() => setConfirm(true)} disabled={busy} className="mt-3 w-full rounded-xl bg-crimson px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">Submit Test</button>
        </aside>
      </main>
      {confirm ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-800/60 p-4" role="dialog" aria-modal="true" aria-label="Confirm submission">
          <div className="w-full max-w-sm rounded-card bg-white p-6 text-center">
            <p className="text-lg font-extrabold text-navy-700">Submit test?</p>
            <p className="mt-2 text-sm text-muted">Answered: <b>{answered}</b> • Unanswered: <b>{unanswered}</b> • Marked: <b>{marked.length}</b></p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirm(false)} className="rounded-xl border border-silver-300 px-4 py-2.5 text-sm font-bold">Cancel</button>
              <button onClick={() => { setConfirm(false); void doSubmit(); }} disabled={busy} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">Confirm Submit</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
