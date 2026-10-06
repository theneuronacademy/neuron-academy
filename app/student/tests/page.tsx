"use client";

// C3 canonicalization — the student catalogue is server-driven ONLY.
// Legacy local reads (getTests/getResults/deriveStatus/visibleToStudents)
// are removed: tab membership and completion come from GET /api/tests
// (server-computed access states) and GET /api/results (own evaluated
// results). Eligibility stays server-enforced; the client only displays.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Unlock } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { cn } from "@/lib/utils";
import type { ApiTest } from "@/services/testApi";

type Tab = "available" | "upcoming" | "completed";

interface ServerResult {
  testId: string;
  marks: number;
  totalMarks: number;
  percentage: number;
}

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
  // Server-evaluated own results drive the Completed tab.
  const [done, setDone] = useState<Map<string, ServerResult> | null>(null);
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
      try {
        const rRes = await fetch("/api/results", { cache: "no-store" });
        const rJson = await rRes.json().catch(() => null);
        const items = rRes.ok && rJson?.success === true && Array.isArray(rJson.data?.items) ? rJson.data.items : [];
        const map = new Map<string, ServerResult>();
        for (const r of items) {
          if (r && typeof r.testId === "string" && !map.has(r.testId)) {
            map.set(r.testId, {
              testId: r.testId,
              marks: Number(r.marks ?? 0),
              totalMarks: Number(r.totalMarks ?? 0),
              percentage: Number(r.percentage ?? 0),
            });
          }
        }
        setDone(map);
      } catch {
        setDone(new Map());
      }
    })();
  }, [session]);
  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  const loading = online === null || done === null;
  const tests = online ?? [];
  const doneMap = done ?? new Map<string, ServerResult>();
  // Tab membership from server state only: access.locked + status come from
  // the API; completion comes from evaluated server results (or COMPLETED).
  const isOpen = (t: ApiTest) => t.status === "PUBLISHED" || t.status === "LIVE";
  const available = tests.filter((t) => {
    const a = t.access;
    const unlocked = !a || !a.locked;
    return unlocked && isOpen(t) && !doneMap.has(t.id);
  });
  const upcoming = tests.filter((t) => t.status === "SCHEDULED");
  const completed = tests.filter((t) => doneMap.has(t.id) || t.status === "COMPLETED");

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
      {loading ? (
        <p className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">Loading tests…</p>
      ) : list.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">
          {tab === "available" ? "No available tests. New published tests appear here instantly." : tab === "upcoming" ? "No upcoming (scheduled) tests." : "No completed tests yet."}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {list.map((t) => {
            const res = doneMap.get(t.id);
            return (
              <div key={t.id} className="card-lift premium-ring rounded-card bg-white p-5">
                <p className="text-[11px] font-bold tracking-widest text-teal-600">{t.type.toUpperCase()} • {t.status.toUpperCase()}</p>
                <h3 className="mt-1 text-[16px] font-extrabold tracking-tight text-navy-700">{t.title}</h3>
                <p className="mt-1 text-[13px] text-muted">{t.totalQuestions} Questions • {t.duration} min</p>
                {res ? (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-teal-50 px-4 py-2.5">
                    <span className="text-sm font-extrabold text-teal-700">{res.marks}/{res.totalMarks} • {res.percentage}%</span>
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
