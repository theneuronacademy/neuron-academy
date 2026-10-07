"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { Skeleton, TrendChart } from "@/components/student/charts";
import { cn } from "@/lib/utils";

interface Mark {
  id: string; testId: string; testTitle: string; marks: number; totalMarks: number; percentage: number;
  correct: number; wrong: number; unanswered: number; date: string;
}

type Tab = "class" | "scholarship" | "other";

/** Phase 14 — own class-test marks (REGULAR only, read-only, server data). */
export default function StudentMarksPage() {
  const session = useStudentGuard();
  const [tab, setTab] = useState<Tab>("class");
  const [data, setData] = useState<{ classTests: Mark[]; scholarshipTests: Mark[]; otherTests: Mark[] } | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch("/api/students/me/marks", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        if (res.ok && json?.success === true) setData(json.data);
        else setData({ classTests: [], scholarshipTests: [], otherTests: [] });
      } catch {
        setData({ classTests: [], scholarshipTests: [], otherTests: [] });
      }
    })();
  }, [session]);

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (forbidden) {
    return (
      <StudentShell title="Marks" subtitle="Regular students">
        <p className="rounded-card bg-white p-8 text-center text-sm font-bold text-muted">Class-test marks are available for regular students only.</p>
      </StudentShell>
    );
  }

  const list = !data ? [] : tab === "class" ? data.classTests : tab === "scholarship" ? data.scholarshipTests : data.otherTests;
  const tabs: { id: Tab; label: string; count: number }[] = data
    ? [
        { id: "class", label: "Class Tests", count: data.classTests.length },
        { id: "scholarship", label: "Scholarship Tests", count: data.scholarshipTests.length },
        { id: "other", label: "Other Tests", count: data.otherTests.length },
      ]
    : [];

  return (
    <StudentShell title="My Marks" subtitle="Class tests • scholarship tests • evaluated results">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("rounded-full px-4 py-2 text-[13px] font-bold capitalize", tab === t.id ? "bg-navy-700 text-white" : "border border-silver-300 bg-white text-navy-700")}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>
      {data === null ? (
        <div className="mt-4 space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : (
        <>
          {list.length > 0 ? (
            <div className="mt-4 min-w-0 rounded-card border border-silver-200 bg-white p-5 shadow-card">
              <h2 className="text-[15px] font-extrabold text-navy-700">Recent Marks Trend</h2>
              <div className="mt-2 overflow-x-auto">
                <TrendChart points={[...list].reverse().slice(-12).map((m) => ({ label: m.testTitle, value: m.percentage }))} />
              </div>
            </div>
          ) : null}
          {list.length === 0 ? (
            <p className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No test data yet.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {list.map((m) => (
                <div key={m.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-card border border-silver-200 bg-white p-4 shadow-card">
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-1.5 text-sm font-extrabold text-navy-700"><Trophy className="h-4 w-4 shrink-0 text-amber-500" /> <span className="truncate">{m.testTitle}</span></p>
                    <p className="mt-0.5 break-words text-[12px] text-muted">
                      {new Date(m.date).toLocaleDateString()} • ✓ {m.correct} • ✗ {m.wrong} • — {m.unanswered}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-extrabold text-navy-700">{m.marks}<span className="text-sm text-muted">/{m.totalMarks}</span></p>
                    <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-extrabold", m.percentage >= 75 ? "bg-teal-50 text-teal-700" : m.percentage >= 40 ? "bg-amber-50 text-amber-700" : "bg-crimson-50 text-crimson")}>
                      {m.percentage}%
                    </span>
                    <Link href={`/student/tests/${m.testId}/result`} className="rounded-xl bg-navy-700 px-3.5 py-2 text-[12px] font-bold text-white">Review</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </StudentShell>
  );
}
