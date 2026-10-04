"use client";

import { useState } from "react";
import Link from "next/link";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { getResults, getTests } from "@/lib/storage";
import { deriveStatus, visibleToStudents } from "@/services/testService";
import { cn } from "@/lib/utils";

type Tab = "available" | "upcoming" | "completed";

export default function StudentTestsPage() {
  const session = useStudentGuard();
  const [tab, setTab] = useState<Tab>("available");
  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  const tests = getTests().filter(visibleToStudents);
  const results = getResults().filter((r) => r.studentId === session.studentId);
  const doneIds = new Set(results.map((r) => r.testId));
  const available = tests.filter((t) => ["published", "live"].includes(deriveStatus(t)) && !doneIds.has(t.id));
  const upcoming = tests.filter((t) => deriveStatus(t) === "scheduled");
  const completed = tests.filter((t) => doneIds.has(t.id) || deriveStatus(t) === "completed");

  const list = tab === "available" ? available : tab === "upcoming" ? upcoming : completed;

  return (
    <StudentShell title="Tests" subtitle="Available • Upcoming • Completed">
      <div className="flex gap-2">
        {(["available", "upcoming", "completed"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-4 py-2 text-[13px] font-bold capitalize", tab === t ? "bg-navy-700 text-white" : "border border-silver-300 bg-white text-navy-700")}>
            {t} ({t === "available" ? available.length : t === "upcoming" ? upcoming.length : completed.length})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">
          {tab === "available" ? "No available tests. New published tests appear here instantly." : tab === "upcoming" ? "No upcoming (scheduled) tests." : "No completed tests yet."}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {list.map((t) => {
            const res = results.find((r) => r.testId === t.id);
            return (
              <div key={t.id} className="card-lift premium-ring rounded-card bg-white p-5">
                <p className="text-[11px] font-bold tracking-widest text-teal-600">{t.subject.toUpperCase()} • {t.chapter.toUpperCase()}</p>
                <h3 className="mt-1 text-[16px] font-extrabold tracking-tight text-navy-700">{t.name}</h3>
                <p className="mt-1 text-[13px] text-muted">{t.questionIds.length} Questions • {t.durationMinutes} min • {t.marksPerQuestion} marks/Q • Negative {t.negativeMarks}</p>
                {res ? (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-teal-50 px-4 py-2.5">
                    <span className="text-sm font-extrabold text-teal-700">{res.marks}/{res.maxMarks} • {res.percentage}%</span>
                    <Link href={`/student/tests/${t.id}/result`} className="text-[13px] font-bold text-teal-700 underline">View Result</Link>
                  </div>
                ) : (
                  <Link href={`/student/tests/${t.id}`} className="btn-metallic-sheen mt-3 block rounded-xl bg-crimson-DEFAULT px-4 py-2.5 text-center text-sm font-bold text-white">
                    {tab === "upcoming" ? "View Details" : "Start Test"}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </StudentShell>
  );
}
