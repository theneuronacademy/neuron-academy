"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, MinusCircle, AlertTriangle } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { getResultFor } from "@/lib/storage";
import { getTestById } from "@/services/testService";
import { cn } from "@/lib/utils";

interface ServerSummary {
  id: string;
  testTitle: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  attempted: number;
  correct: number;
  wrong: number;
  unanswered: number;
  rank: number | null;
  date: string;
}

interface ReviewItem {
  order: number;
  questionId: string;
  questionText: string;
  options: (string | null)[];
  yourAnswer: string | null;
  correctAnswer: string | null;
  marksAwarded: number;
  maxMarks: number;
  status: string;
}

// Phase 6: prefers the server result/review when PostgreSQL is live
// (own result only — API enforces ownership). Local engine stays fallback.
export default function StudentResultPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const session = useStudentGuard();
  const [server, setServer] = useState<ServerSummary | null>(null);
  const [review, setReview] = useState<ReviewItem[]>([]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch(`/api/results?testId=${encodeURIComponent(id)}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const row = json?.success === true && Array.isArray(json.data?.items) ? json.data.items[0] : null;
        if (!row) return;
        setServer({
          id: String(row.id),
          testTitle: String(row.testTitle ?? ""),
          marks: Number(row.marks ?? 0),
          totalMarks: Number(row.totalMarks ?? 0),
          percentage: Number(row.percentage ?? 0),
          attempted: Number(row.attempted ?? 0),
          correct: Number(row.correct ?? 0),
          wrong: Number(row.wrong ?? 0),
          unanswered: Number(row.unanswered ?? 0),
          rank: typeof row.rank === "number" ? row.rank : null,
          date: String(row.date ?? ""),
        });
        try {
          const rRes = await fetch(`/api/tests/${encodeURIComponent(id)}/review`, { cache: "no-store" });
          const rJson = await rRes.json().catch(() => null);
          if (rJson?.success === true && Array.isArray(rJson.data?.items)) setReview(rJson.data.items);
        } catch {
          /* summary still renders */
        }
      } catch {
        /* local fallback */
      }
    })();
  }, [session, id]);

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  if (server) {
    const cards = [
      { label: "Score", value: `${server.marks}/${server.totalMarks}` },
      { label: "Percentage", value: `${server.percentage}%` },
      { label: "Attempted", value: String(server.attempted) },
      { label: "Correct", value: String(server.correct) },
      { label: "Wrong", value: String(server.wrong) },
      { label: "Unanswered", value: String(server.unanswered) },
      { label: "Date", value: server.date || "—" },
      ...(server.rank === null ? [] : [{ label: "Rank", value: `#${server.rank}` }]),
    ];
    return (
      <StudentShell title={`${server.testTitle} — Result`} subtitle={`${server.correct} correct • ${server.wrong} wrong • ${server.unanswered} skipped • server evaluated`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <p className="text-[11px] font-bold tracking-widest text-muted">{c.label.toUpperCase()}</p>
              <p className="mt-1 text-2xl font-extrabold text-navy-700">{c.value}</p>
            </div>
          ))}
        </div>
        {review.length > 0 ? (
          <>
            <h2 className="mt-6 text-[15px] font-extrabold text-navy-700">Question-wise Review</h2>
            <div className="mt-3 grid gap-3">
              {review.map((d) => (
                <div key={d.questionId} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
                  <p className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                    d.status === "correct" ? "bg-teal-50 text-teal-700" : d.status === "incorrect" ? "bg-crimson-50 text-crimson-DEFAULT" : d.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-silver-50 text-muted")}>
                    {d.status === "correct" ? <CheckCircle2 className="h-3 w-3" /> : d.status === "incorrect" ? <XCircle className="h-3 w-3" /> : d.status === "pending" ? <AlertTriangle className="h-3 w-3" /> : <MinusCircle className="h-3 w-3" />}
                    Q{d.order} • {d.status.toUpperCase()} • +{d.marksAwarded}/{d.maxMarks}
                  </p>
                  <p className="mt-2 text-sm font-extrabold text-ink">{d.questionText}</p>
                  <div className="mt-2 grid gap-1 text-[13px]">
                    {d.options.map((o, oi) => {
                      const letter = "ABCD"[oi];
                      return (
                        <p key={oi} className={cn("rounded-lg border px-3 py-1.5",
                          letter === d.correctAnswer ? "border-teal-500 bg-teal-50 font-bold" : letter === d.yourAnswer ? "border-crimson-DEFAULT bg-crimson-50" : "border-silver-200")}>
                          <span className="font-extrabold">{letter}.</span> {o ?? <span className="text-muted">(empty)</span>}
                          {letter === d.correctAnswer ? " ✓" : letter === d.yourAnswer && d.status === "incorrect" ? " (your answer)" : ""}
                        </p>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[12px] font-bold text-muted">
                    Your Answer: {d.yourAnswer ?? "—"} • Correct Answer: {d.correctAnswer ?? "Pending faculty review"}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/student/tests" className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white">Back to Tests</Link>
          <Link href="/student/dashboard" className="rounded-xl border border-silver-300 bg-white px-5 py-2.5 text-sm font-bold text-navy-700">Dashboard</Link>
        </div>
      </StudentShell>
    );
  }

  const test = getTestById(id);
  const result = getResultFor(id, session.studentId);
  if (!test || !result) {
    return (
      <StudentShell title="Result">
        <p className="rounded-card bg-white p-6 text-sm font-bold text-muted">No result yet. <Link href="/student/tests" className="text-teal-600 underline">Back to tests</Link></p>
      </StudentShell>
    );
  }

  const cards = [
    { label: "Score", value: `${result.marks}/${result.maxMarks}` },
    { label: "Percentage", value: `${result.percentage}%` },
    { label: "Correct", value: String(result.correct) },
    { label: "Incorrect", value: String(result.incorrect) },
    { label: "Unattempted", value: String(result.unattempted) },
    { label: "Accuracy", value: `${result.accuracy}%` },
    { label: "Time Taken", value: `${Math.floor(result.timeTakenSec / 60)}m ${result.timeTakenSec % 60}s` },
  ];

  return (
    <StudentShell title={`${result.testName} — Result`} subtitle={`${result.correct} correct • ${result.incorrect} wrong • ${result.unattempted} skipped${result.pending ? ` • ${result.pending} faculty review` : ""}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold tracking-widest text-muted">{c.label.toUpperCase()}</p>
            <p className="mt-1 text-2xl font-extrabold text-navy-700">{c.value}</p>
          </div>
        ))}
      </div>
      {result.pending > 0 ? (
        <p className="mt-4 flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 p-4 text-[13px] font-semibold text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {result.pending} question(s) have no verified answer and were sent for faculty review — excluded from auto scoring.
        </p>
      ) : null}
      <h2 className="mt-6 text-[15px] font-extrabold text-navy-700">Question-wise Analysis</h2>
      <div className="mt-3 grid gap-3">
        {result.details.map((d, i) => (
          <div key={d.questionId} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
            <p className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
              d.status === "correct" ? "bg-teal-50 text-teal-700" : d.status === "incorrect" ? "bg-crimson-50 text-crimson-DEFAULT" : d.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-silver-50 text-muted")}>
              {d.status === "correct" ? <CheckCircle2 className="h-3 w-3" /> : d.status === "incorrect" ? <XCircle className="h-3 w-3" /> : d.status === "pending" ? <AlertTriangle className="h-3 w-3" /> : <MinusCircle className="h-3 w-3" />}
              Q{i + 1} • {d.status.toUpperCase()}
            </p>
            <p className="mt-2 text-sm font-extrabold text-ink">{d.question}</p>
            <div className="mt-2 grid gap-1 text-[13px]">
              {d.options.map((o, oi) => (
                <p key={oi} className={cn("rounded-lg border px-3 py-1.5",
                  oi === d.correctAnswer ? "border-teal-500 bg-teal-50 font-bold" : oi === d.yourAnswer ? "border-crimson-DEFAULT bg-crimson-50" : "border-silver-200")}>
                  <span className="font-extrabold">{"ABCD"[oi]}.</span> {o}
                  {oi === d.correctAnswer ? " ✓" : oi === d.yourAnswer && d.status === "incorrect" ? " (your answer)" : ""}
                </p>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] font-bold text-muted">
              Your Answer: {d.yourAnswer === null ? "—" : "ABCD"[d.yourAnswer]} • Correct Answer: {d.correctAnswer === null ? "Pending faculty review" : "ABCD"[d.correctAnswer]}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/student/tests" className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white">Back to Tests</Link>
        <Link href="/student/dashboard" className="rounded-xl border border-silver-300 bg-white px-5 py-2.5 text-sm font-bold text-navy-700">Dashboard</Link>
      </div>
    </StudentShell>
  );
}
