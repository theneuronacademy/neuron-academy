"use client";

// C3 canonicalization — the student catalogue is server-driven ONLY.
// Legacy local reads (getTests/getResults/deriveStatus/visibleToStudents)
// are removed: tab membership and completion come from GET /api/tests
// (server-computed access states) and GET /api/results (own evaluated
// results). Eligibility stays server-enforced; the client only displays.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Unlock, Trophy, Timer } from "lucide-react";
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

/** Ticking countdown to a test's endTime (LIVE tests). */
function LiveCountdown({ endTime }: { endTime: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((new Date(endTime).getTime() - now) / 1000));
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-crimson px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-white" role="timer" aria-label="Time left">
      <Timer className="h-3 w-3" /> {left === 0 ? "ENDED" : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`}
    </span>
  );
}

interface BoardEntry { rank: number; name: string; percentage: number; marks: number; totalMarks: number; isMe: boolean }

export default function StudentTestsPage() {
  const session = useStudentGuard();
  const [tab, setTab] = useState<Tab>("available");
  // Phase 13 — API-backed academy tests (FREE/PAID/PRIVATE with access states).
  const [online, setOnline] = useState<ApiTest[] | null>(null);
  // Server-evaluated own results drive the Completed tab.
  const [done, setDone] = useState<Map<string, ServerResult> | null>(null);
  // IN_PROGRESS attempt testIds → Resume buttons.
  const [resumable, setResumable] = useState<Set<string>>(new Set());
  // Leaderboard modal state.
  const [boardFor, setBoardFor] = useState<{ id: string; title: string } | null>(null);
  const [board, setBoard] = useState<{ entries: BoardEntry[]; myRank: number | null; total: number } | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
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
      try {
        const aRes = await fetch("/api/attempts", { cache: "no-store" });
        const aJson = await aRes.json().catch(() => null);
        const arr = aRes.ok && aJson?.success === true && Array.isArray(aJson.data?.items) ? aJson.data.items : [];
        setResumable(new Set((arr as { testId: string; status: string }[]).filter((a) => a.status === "IN_PROGRESS").map((a) => a.testId)));
      } catch {
        setResumable(new Set());
      }
    })();
  }, [session]);

  async function openBoard(id: string, title: string) {
    setBoardFor({ id, title });
    setBoard(null);
    setBoardLoading(true);
    try {
      const res = await fetch(`/api/tests/${encodeURIComponent(id)}/leaderboard`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        setBoard({ entries: json.data.entries ?? [], myRank: json.data.myRank ?? null, total: json.data.total ?? 0 });
      } else setBoard({ entries: [], myRank: null, total: 0 });
    } catch {
      setBoard({ entries: [], myRank: null, total: 0 });
    } finally {
      setBoardLoading(false);
    }
  }
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
  const homework = tests.filter((t) => t.isHomework && (!t.access || !t.access.locked) && isOpen(t) && !doneMap.has(t.id));

  return (
    <StudentShell title="Tests" subtitle="Available • Upcoming • Completed • Homework">
      {/* HOMEWORK — faculty-assigned practice, impossible to miss */}
      {homework.length > 0 ? (
        <div className="mb-6 rounded-card border border-amber-300 bg-gradient-to-br from-amber-50 to-white p-5 shadow-card">
          <h2 className="text-[15px] font-extrabold text-navy-700">📝 Homework Due</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {homework.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-amber-200">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-navy-700">{t.title}</p>
                  <p className="text-[12px] text-muted">{t.duration} min • {t.totalQuestions} Qs</p>
                </div>
                <Link href={`/student/tests/${t.id}`} className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-amber-600">
                  {resumable.has(t.id) ? "Resume →" : "Do Now →"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
                  {t.type === "LIVE" && t.status === "LIVE" && t.endTime ? (
                    <div className="mt-2"><LiveCountdown endTime={t.endTime} /></div>
                  ) : null}
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
                      <Link href={`/student/tests/${t.id}`} className="btn-metallic-sheen block rounded-xl bg-crimson px-4 py-2.5 text-center text-sm font-bold text-white">{resumable.has(t.id) ? "Resume →" : "Start Test"}</Link>
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
                  <p className="text-[11px] font-bold tracking-widest text-teal-600">{t.type.toUpperCase()} • {t.status.toUpperCase()}{t.isHomework ? " • HOMEWORK" : ""}</p>
                  <h3 className="mt-1 text-[16px] font-extrabold tracking-tight text-navy-700">{t.title}</h3>
                  <p className="mt-1 text-[13px] text-muted">{t.totalQuestions} Questions • {t.duration} min</p>
                  {t.type === "LIVE" && t.status === "LIVE" && t.endTime ? (
                    <div className="mt-2"><LiveCountdown endTime={t.endTime} /></div>
                  ) : null}
                {res ? (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-teal-50 px-4 py-2.5">
                    <span className="text-sm font-extrabold text-teal-700">{res.marks}/{res.totalMarks} • {res.percentage}%</span>
                    <span className="flex gap-3">
                      <button onClick={() => openBoard(t.id, t.title)} className="inline-flex items-center gap-1 text-[13px] font-bold text-amber-600 underline"><Trophy className="h-3.5 w-3.5" /> Ranks</button>
                      <Link href={`/student/tests/${t.id}/result`} className="text-[13px] font-bold text-teal-700 underline">View Result</Link>
                    </span>
                  </div>
                ) : (
                  <Link href={`/student/tests/${t.id}`} className="btn-metallic-sheen mt-3 block rounded-xl bg-crimson px-4 py-2.5 text-center text-sm font-bold text-white">
                    {tab === "upcoming" ? "View Details" : resumable.has(t.id) ? "Resume →" : "Start Test"}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
      {boardFor ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-800/60 p-4" role="dialog" aria-modal="true" aria-label={`Leaderboard for ${boardFor.title}`}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-card bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-extrabold text-navy-700">🏆 {boardFor.title}</p>
              <button onClick={() => setBoardFor(null)} className="rounded-lg border border-silver-300 px-3 py-1.5 text-[12px] font-bold text-navy-700">Close</button>
            </div>
            {boardLoading || !board ? (
              <p className="mt-3 py-6 text-center text-sm font-bold text-muted">Loading ranks…</p>
            ) : board.entries.length === 0 ? (
              <p className="mt-3 py-6 text-center text-sm font-bold text-muted">No evaluated results yet — be the first on the board.</p>
            ) : (
              <>
                {board.myRank !== null ? (
                  <p className="mt-2 rounded-xl bg-teal-50 px-3 py-2 text-center text-[13px] font-extrabold text-teal-700">
                    Your rank: #{board.myRank} of {board.total}
                  </p>
                ) : null}
                <ul className="mt-2 space-y-1.5">
                  {board.entries.slice(0, 20).map((e) => (
                    <li key={`${e.rank}-${e.name}`} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${e.isMe ? "bg-teal-50 ring-1 ring-teal-300" : "bg-silver-50"}`}>
                      <p className="min-w-0 truncate text-[13px] font-bold text-navy-700">
                        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy-700 text-[11px] font-extrabold text-white">{e.rank}</span>
                        {e.name}{e.isMe ? " (you)" : ""}
                      </p>
                      <p className="shrink-0 text-[13px] font-extrabold text-navy-700">{e.percentage}%</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : null}
    </StudentShell>
  );
}
