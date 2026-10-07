"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { Skeleton } from "@/components/student/charts";
import { cn } from "@/lib/utils";

interface ResultRow {
  id: string;
  testId: string;
  testTitle: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  correct: number;
  wrong: number;
  unanswered: number;
  attempted: number;
  status: string;
  date: string;
}

/** Phase 16 — own results (server-authoritative, own rows only). */
export default function StudentResultsPage() {
  const session = useStudentGuard();
  const [items, setItems] = useState<ResultRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!session) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/results", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!live) return;
        if (res.ok && json?.success === true && Array.isArray(json.data?.items)) {
          setItems(json.data.items as ResultRow[]);
        } else if (res.status === 401 || res.status === 403) {
          setFailed(true);
          setItems([]);
        } else {
          setFailed(true);
          setItems([]);
        }
      } catch {
        if (live) {
          setFailed(true);
          setItems([]);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [session]);

  if (!session)
    return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  return (
    <StudentShell title="My Results" subtitle="Server-evaluated • your attempts only">
      {items === null ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : failed ? (
        <div className="rounded-card border border-amber-300 bg-amber-50 p-6 text-center" role="alert">
          <p className="text-sm font-extrabold text-amber-800">Could not load results.</p>
          <p className="mt-1 text-[13px] font-semibold text-amber-700">Check your connection and try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center">
          <p className="text-sm font-extrabold text-navy-700">No results yet.</p>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            Attempt a test and your server-evaluated score will appear here.
          </p>
          <Link
            href="/student/tests"
            className="mt-4 inline-block rounded-xl bg-crimson px-5 py-2.5 text-sm font-bold text-white"
          >
            Browse tests
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((r) => (
            <div
              key={r.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-card border border-silver-200 bg-white p-4 shadow-card"
            >
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-extrabold text-navy-700">
                  <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="truncate">{r.testTitle || "Test"}</span>
                </p>
                <p className="mt-0.5 break-words text-[12px] text-muted">
                  {r.date || "—"} • ✓ {r.correct} • ✗ {r.wrong} • — {r.unanswered} • {r.status}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="text-xl font-extrabold text-navy-700">
                  {r.marks}
                  <span className="text-sm text-muted">/{r.totalMarks}</span>
                </p>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[12px] font-extrabold",
                    r.percentage >= 75
                      ? "bg-teal-50 text-teal-700"
                      : r.percentage >= 40
                        ? "bg-amber-50 text-amber-700"
                        : "bg-crimson-50 text-crimson"
                  )}
                >
                  {r.percentage}%
                </span>
                <Link
                  href={`/student/tests/${r.testId}/result`}
                  className="rounded-xl bg-navy-700 px-3.5 py-2 text-[12px] font-bold text-white"
                >
                  Review
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </StudentShell>
  );
}
