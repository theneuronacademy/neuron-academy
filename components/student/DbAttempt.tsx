"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Flag, Loader2, Lock, Timer } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { cn } from "@/lib/utils";
import { deadlineFromRemaining, hydrateAnswers, remainingSeconds } from "@/lib/attemptResume";

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
  const [left, setLeft] = useState(1200);
  const [resumed, setResumed] = useState(false);
  // Fixed point (ms epoch) when time runs out, derived ONCE from server
  // values (attempt.startedAt + serverNow) at begin/resume. Refresh
  // recomputes it from the server — the duration is never restarted.
  const deadlineRef = useRef<number>(0);
  // Latest answers mirror so the countdown auto-submit never uses a stale
  // closure (refresh-safe even mid-render).
  const answersRef = useRef<Record<string, string | null>>({});
  const submittedRef = useRef(false);
  // Autosave: server clock this tab based its last save on (optimistic
  // locking), question IDs changed since that save, debounce timer, and UI
  // state. Local answers are NEVER dropped on save failure.
  const baseUpdatedAtRef = useRef<string | null>(null);
  const dirtyRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

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
      if (aRes.status === 409) {
        // Single-attempt rule: a submitted attempt already exists — the only
        // correct next step is the result page, never a new attempt.
        router.push(`/student/tests/${testId}/result`);
        return;
      }
      if (aRes.status === 404) {
        setPhase("missing");
        return;
      }
      if (!aRes.ok || aJson?.success !== true || !aJson.data?.attempt) {
        setError(aJson?.error ?? "Could not start the test.");
        return;
      }
      const attempt = aJson.data.attempt as { id: string; startedAt?: string; answers?: unknown };
      const wasResumed = aJson.data.resumed === true;
      const aid = String(attempt.id);
      const qRes = await fetch(`/api/questions?testId=${encodeURIComponent(testId)}&attemptId=${encodeURIComponent(aid)}`, { cache: "no-store" });
      const qJson = await qRes.json().catch(() => null);
      if (qRes.status === 409) {
        router.push(`/student/tests/${testId}/result`);
        return;
      }
      if (!qRes.ok || qJson?.success !== true || !Array.isArray(qJson.data?.items)) {
        setError(qJson?.error ?? "Could not load questions.");
        return;
      }
      const items = qJson.data.items as PaperQ[];
      if (items.length === 0) {
        setError("This test has no questions yet. Please try again later.");
        return;
      }
      // Resume: restore server-saved answers (validated shape; anything
      // missing or malformed counts as unanswered) and derive the deadline
      // from the SERVER clock — never restart the duration on refresh.
      const restored = hydrateAnswers(attempt.answers);
      const remain = meta
        ? remainingSeconds({ startedAt: attempt.startedAt, durationMin: meta.duration, serverNow: aJson.data.serverNow })
        : null;
      if (remain === null) {
        setError("Could not determine the remaining time. Please try again.");
        return;
      }
      setAttemptId(aid);
      setAnswers(restored);
      answersRef.current = restored;
      dirtyRef.current.clear();
      baseUpdatedAtRef.current = typeof (attempt as { updatedAt?: unknown }).updatedAt === "string" ? String((attempt as { updatedAt?: unknown }).updatedAt) : null;
      setSaveState("idle");
      setSaveError(null);
      setPaper(items);
      setIdx(0);
      setMarked([]);
      setResumed(wasResumed);
      if (remain <= 0) {
        // Expired before/at resume: do not continue answering. Submit once
        // with whatever the server holds; the server scores authoritatively.
        setLeft(0);
        setPhase("attempt");
        await doSubmit({ attemptId: aid, answers: restored });
        return;
      }
      deadlineRef.current = deadlineFromRemaining(remain);
      setLeft(remain);
      setPhase("attempt");
    } catch {
      setError("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function doSubmit(override?: { attemptId: string; answers: Record<string, string | null> }) {
    if (submittedRef.current) return;
    const aid = override?.attemptId ?? attemptId;
    if (!aid) return;
    // Flush any pending autosave first (best-effort): the submit body carries
    // the authoritative answers regardless, so a failed flush never blocks.
    if (!override) {
      try {
        await saveNow({ force: true, redirectOnExpiry: false });
      } catch {
        /* submit carries answers anyway */
      }
      if (submittedRef.current) return;
    }
    submittedRef.current = true;
    setBusy(true);
    try {
      const res = await fetch(`/api/tests/${encodeURIComponent(testId)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: aid, answers: override?.answers ?? answersRef.current }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 409) {
        // Already submitted (duplicate click, retry, or second tab): the
        // result is the only valid destination — never loop submissions.
        setPhase("done");
        router.push(`/student/tests/${testId}/result`);
        return;
      }
      if (res.status === 404) {
        setError("Attempt not found. It may have been cleared — go back and start again.");
        submittedRef.current = false;
        setBusy(false);
        return;
      }
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

  // Latest-submit callback for the countdown (avoids stale closures).
  const submitRef = useRef<() => void>(() => undefined);
  submitRef.current = () => {
    void doSubmit();
  };

  // Mirror every answer selection so auto-submit always sends the latest.
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  /** Persist the current draft (debounced caller below). Returns true when
   * the server holds exactly what this tab sent. Never drops local answers:
   * failures keep everything locally and report, for retry or submit-flush.
   * Set redirectOnExpiry=false when called as a submit flush (the submit
   * itself then decides, authoritatively). */
  const saveNow = useCallback(async (opts?: { force?: boolean; rebased?: boolean; redirectOnExpiry?: boolean }): Promise<boolean> => {
    const aid = attemptId;
    if (!aid || submittedRef.current || saveInFlightRef.current) return false;
    if (!opts?.force && dirtyRef.current.size === 0) return true;
    saveInFlightRef.current = true;
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch(`/api/tests/${encodeURIComponent(testId)}/attempt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: aid, answers: answersRef.current, baseUpdatedAt: baseUpdatedAtRef.current }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        baseUpdatedAtRef.current = typeof json.data?.updatedAt === "string" ? json.data.updatedAt : baseUpdatedAtRef.current;
        dirtyRef.current.clear();
        setSaveState("saved");
        return true;
      }
      if (res.status === 409 && json?.code === "ATTEMPT_STALE" && !opts?.rebased) {
        // Another writer won the race: rebase local dirty answers onto the
        // current server draft and retry exactly once.
        const server = hydrateAnswers(json?.data?.answers);
        const merged: Record<string, string | null> = { ...server };
        for (const k of dirtyRef.current) {
          const v = answersRef.current[k];
          if (v === undefined) delete merged[k];
          else merged[k] = v;
        }
        baseUpdatedAtRef.current = typeof json?.data?.updatedAt === "string" ? json.data.updatedAt : null;
        setAnswers(merged);
        answersRef.current = merged;
        saveInFlightRef.current = false;
        return saveNow({ force: true, rebased: true, redirectOnExpiry: opts?.redirectOnExpiry });
      }
      if (res.status === 409) {
        // Already submitted elsewhere: results are the destination, not a loop.
        router.push(`/student/tests/${testId}/result`);
        return false;
      }
      if (res.status === 410) {
        if (opts?.redirectOnExpiry === false) return false;
        submitRef.current();
        return false;
      }
      setSaveError(json?.error ?? "Could not save answers.");
      setSaveState("failed");
      return false;
    } catch {
      setSaveError("Cannot reach the server. Answers kept on this device.");
      setSaveState("failed");
      return false;
    } finally {
      saveInFlightRef.current = false;
    }
  }, [attemptId, testId, router]);

  // Debounce saves so answering never spams the endpoint. Re-runs only when
  // answers change: a failed save does not reschedule itself (Retry button
  // and the submit flush cover recovery, so failures never loop requests).
  useEffect(() => {
    if (phase !== "attempt" || !attemptId || submittedRef.current || dirtyRef.current.size === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveNow();
    }, 1200);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [answers, phase, attemptId, saveNow]);

  useEffect(() => {
    if (phase !== "attempt") return;
    const t = setInterval(() => {
      const remain = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      if (remain <= 0) {
        clearInterval(t);
        setLeft(0);
        submitRef.current();
      } else {
        setLeft(remain);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Phase 16 — accidental-navigation guard during an live attempt.
  // Server state is authoritative; this only prevents losing focus/time.
  useEffect(() => {
    if (phase !== "attempt") return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
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
              <li>Refreshing keeps your remaining time — the server clock decides, not this page.</li>
              <li>Evaluated on the server once, at submit.</li>
            </ul>
            {meta.description ? <p className="mt-3 text-[13px] text-muted">{meta.description}</p> : null}
            {error ? (
              <div className="mt-3 rounded-xl bg-crimson-50 px-4 py-2.5">
                <p className="text-sm font-bold text-crimson" role="alert">{error}</p>
                <button onClick={() => void begin()} disabled={busy} className="mt-2 rounded-xl border border-crimson/40 px-4 py-2 text-sm font-bold text-crimson disabled:opacity-60">Retry</button>
              </div>
            ) : null}
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
          <p className="min-w-0 flex-1 truncate text-sm font-extrabold text-navy-700">{meta.title} <span className="font-semibold text-muted">• Q{idx + 1}/{paper.length}</span></p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[11px] font-bold text-muted sm:inline" role="status" aria-live="polite">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "All answers saved ✓" : saveState === "failed" ? (saveError ?? "Save failed — kept locally") : ""}
            </span>
            {saveState === "failed" ? (
              <button onClick={() => void saveNow({ force: true })} className="rounded-lg border border-crimson/40 px-2 py-1 text-[11px] font-bold text-crimson">Retry save</button>
            ) : null}
            <span className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-extrabold", left < 60 ? "bg-crimson-50 text-crimson" : "bg-navy-800 text-white")} role="timer" aria-label={`${fmt(left)} remaining`}>
              <Timer className="h-4 w-4" /> {fmt(left)}
            </span>
            <button onClick={() => setConfirm(true)} disabled={busy || paper.length === 0} className="min-h-11 rounded-xl bg-teal-600 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-60">Submit</button>
          </div>
        </div>
        <div className="h-1 bg-silver-200">
          <div className="h-full bg-teal-500 transition-all" style={{ width: `${paper.length ? (answered / paper.length) * 100 : 0}%` }} />
        </div>
      </div>
      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_250px]">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6">
          {resumed ? (
            <p className="mb-3 rounded-xl bg-teal-50 px-4 py-2.5 text-[13px] font-bold text-teal-700" role="status">
              Resumed your in-progress attempt — {answered} answer{answered === 1 ? "" : "s"} restored, time continues from the server clock.
            </p>
          ) : null}
          {error ? <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          {!q ? (
            <p className="text-sm font-bold text-muted">No questions in this test.</p>
          ) : (
            <>
              <p className="text-[12px] font-bold text-muted">Question {idx + 1} • {q.marks} marks{q.negativeMarks ? ` • −${q.negativeMarks} negative` : ""}</p>
              <h2 className="mt-1 break-words text-[16px] font-extrabold leading-snug text-ink">{q.questionText}</h2>
              <div className="mt-4 grid gap-2">
                {q.options.map((o) => (
                  <button
                    key={o.display}
                    onClick={() => {
                      dirtyRef.current.add(q.id);
                      setAnswers((a) => ({ ...a, [q.id]: o.display }));
                    }}
                    className={cn("min-h-11 break-words rounded-xl border px-4 py-3 text-left text-sm font-semibold transition", answers[q.id] === o.display ? "border-teal-500 bg-teal-50 text-navy-700 ring-2 ring-teal-500/20" : "border-silver-200 hover:border-teal-400")}
                    aria-pressed={answers[q.id] === o.display}
                  >
                    <span className="mr-2 font-extrabold">{o.display}.</span><span className="break-words">{o.text ?? <span className="text-muted">(empty)</span>}</span>
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
                <button onClick={() => { dirtyRef.current.add(q.id); setAnswers((a) => ({ ...a, [q.id]: null })); }} className="rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold text-muted">Clear Response</button>
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
          <button onClick={() => setConfirm(true)} disabled={busy || paper.length === 0} className="mt-3 w-full rounded-xl bg-crimson px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">Submit Test</button>
        </aside>
      </main>
      {confirm ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-navy-800/60 p-4" role="dialog" aria-modal="true" aria-label="Confirm submission">
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-card bg-white p-6 text-center">
            <p className="text-lg font-extrabold text-navy-700">Submit test?</p>
            <p className="mt-2 break-words text-sm text-muted">Answered: <b>{answered}</b> • Unanswered: <b>{unanswered}</b> • Marked: <b>{marked.length}</b></p>
            <p className="mt-1 text-[12px] font-semibold text-muted">This cannot be undone. The server will evaluate your answers.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirm(false)} className="min-h-11 rounded-xl border border-silver-300 px-4 py-2.5 text-sm font-bold">Cancel</button>
              <button onClick={() => { setConfirm(false); void doSubmit(); }} disabled={busy} className="min-h-11 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">Confirm Submit</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
