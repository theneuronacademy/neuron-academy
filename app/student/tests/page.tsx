"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Unlock } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { getResults, getTests } from "@/lib/storage";
import { deriveStatus, visibleToStudents } from "@/services/testService";
import { cn } from "@/lib/utils";
import type { ApiTest } from "@/services/testApi";

type Tab = "available" | "upcoming" | "completed";

/** Phase 13 — access badge for API-backed tests. */
function AccessBadge({ t }: { t: ApiTest }) {
  const a = t.access;
  if (!a) return null;
  if (a.accessType === "FREE") {
    return <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">FREE</span>;
  }
  if (a.accessType === "PAID") {
    return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">₹{a.price}</span>;
  }
  return <span className="rounded-full bg-silver-100 px-2.5 py-1 text-[11px] font-bold text-muted">PRIVATE</span>;
}

export default function StudentTestsPage() {
  const session = useStudentGuard();
  const [tab, setTab] = useState<Tab>("available");
  // Phase 13 — API-backed academy tests (FREE/PAID/PRIVATE with access states).
  const [online, setOnline] = useState<ApiTest[] | null>(null);
  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch("/api/tests", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success === true && Array.isArray(json.data?.items)) {
          setOnline(json.data.items as ApiTest[]);
        } else {
          setOnline([]);
        }
      } catch {
        setOnline([]);
      }
    })();
  }, [session]);
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
      {/* Phase 13 — academy tests with FREE / PAID / PRIVATE access states. */}
      <div className="mb-6">
        <h2 className="text-[15px] font-extrabold text-navy-700">Academy Tests</h2>
        {online === null ? (
          <p className="mt-2 text-sm text-muted">Loading academy tests…</p>
        ) : online.length === 0 ? (
          <p className="mt-2 rounded-card border border-dashed border-silver-300 bg-white p-6 text-center text-sm font-bold text-muted">No academy tests published yet. Scholarship tests appear here.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {online.map((t) => {
              const a = t.access;
              const locked = !a || a.locked;
              return (
                <div key={t.id} className="card-lift premium-ring rounded-card bg-white p-5">
                  <div className="flex items-center justify-between gap-2">
                    <AccessBadge t={t} />
                    <span className="text-[11px] font-bold text-muted">{t.duration} min • {t.totalQuestions} Qs</span>
                  </div>
                  <h3 className="mt-2 text-[16px] font-extrabold tracking-tight text-navy-700">{t.title}</h3>
                  {t.description ? <p className="mt-1 line-clamp-2 text-[13px] text-muted">{t.description}</p> : null}
                  {locked ? (
                    <div className="mt-3 rounded-xl bg-silver-50 px-4 py-2.5 text-center">
                      <p className="flex items-center justify-center gap-1.5 text-sm font-extrabold text-muted"><Lock className="h-4 w-4" /> Locked</p>
                      <p className="mt-0.5 text-[12px] font-semibold text-muted">{a?.lockReason ?? "Contact the academy/admin after payment."}</p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      {a && a.accessType !== "FREE" ? (
                        <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-teal-700"><Unlock className="h-3.5 w-3.5" /> Access Granted</p>
                      ) : null}
                      <Link href={`/student/tests/${t.id}`} className="btn-metallic-sheen block rounded-xl bg-crimson px-4 py-2.5 text-center text-sm font-bold text-white">Start Test</Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
                  <Link href={`/student/tests/${t.id}`} className="btn-metallic-sheen mt-3 block rounded-xl bg-crimson px-4 py-2.5 text-center text-sm font-bold text-white">
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
