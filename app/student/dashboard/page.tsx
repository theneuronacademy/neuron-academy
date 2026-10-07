"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell, FileText, Trophy, CalendarCheck, BarChart3, BookOpen, User, FlaskConical, ArrowRight, GraduationCap,
} from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { profileCompletion, useStudentProfile } from "@/components/student/useStudentProfile";
import { Bars, Ring, Skeleton, TrendChart, greeting } from "@/components/student/charts";
import type { ApiTest } from "@/services/testApi";

interface Analytics {
  tests: { attempted: number; completed: number; inProgress: number; averagePercentage: number | null; highest: number | null; lowest: number | null; trend: { title: string; percentage: number; date: string }[] };
  attendance: { total: number; present: number; absent: number; late: number; leave: number; percentage: number | null };
}

interface FeedItem { id: string; title: string; message: string; isRead: boolean }
interface BookRow { id: string; title: string; author: string | null; subject: string | null; coverImageUrl: string | null }
interface ResultRow { id: string; testId: string; testTitle: string; marks: number; totalMarks: number; percentage: number; date: string }
interface BatchInfo { id: string; name: string; status: string; course: { name: string } | null }

/** Phase 14 — premium student dashboard (REGULAR full / SCHOLARSHIP slim). */
export default function StudentDashboardPage() {
  const session = useStudentGuard();
  const { profile, loading: profileLoading } = useStudentProfile();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsFailed, setAnalyticsFailed] = useState(false);
  const [tests, setTests] = useState<ApiTest[] | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [books, setBooks] = useState<BookRow[] | null>(null);
  // Phase 16 — recent server-evaluated results + current batch (REGULAR).
  const [recentResults, setRecentResults] = useState<ResultRow[] | null>(null);
  const [batch, setBatch] = useState<BatchInfo | null>(null);

  const scholarship = profile?.studentType === "SCHOLARSHIP";

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch("/api/students/me/analytics", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success === true) setAnalytics(json.data as Analytics);
        else setAnalyticsFailed(true);
      } catch {
        setAnalyticsFailed(true);
      }
      try {
        const res = await fetch("/api/tests", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        setTests(res.ok && json?.success === true && Array.isArray(json.data?.items) ? json.data.items : []);
      } catch {
        setTests([]);
      }
      try {
        const res = await fetch("/api/notifications/mine", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success === true && Array.isArray(json.data?.items)) {
          setFeed((json.data.items as FeedItem[]).slice(0, 5));
          setUnread(Number(json.data.unreadCount ?? 0));
        } else setFeed([]);
      } catch {
        setFeed([]);
      }
      try {
        const res = await fetch("/api/books", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        setBooks(res.ok && json?.success === true && Array.isArray(json.data?.items) ? (json.data.items as BookRow[]).slice(0, 3) : []);
      } catch {
        setBooks([]);
      }
      // Phase 16 — recent results (own rows only; empty when none).
      try {
        const res = await fetch("/api/results", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const items = res.ok && json?.success === true && Array.isArray(json.data?.items) ? (json.data.items as ResultRow[]) : [];
        setRecentResults(items.slice(0, 5));
      } catch {
        setRecentResults([]);
      }
      // Phase 16 — current batch card (REGULAR only; 403 → scholarship/null).
      try {
        const res = await fetch("/api/students/me/batches", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success === true && json.data?.batch) {
          setBatch(json.data.batch as BatchInfo);
        } else {
          setBatch(null);
        }
      } catch {
        setBatch(null);
      }
    })();
  }, [session]);

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  const name = profile?.name ?? session.name;
  const completion = profileCompletion(profile);
  const openTests = (tests ?? []).filter((t) => !t.access || !t.access.locked);
  const upcoming = openTests.slice(0, 3);

  const quickActions = scholarship
    ? [
        { href: "/student/tests", label: "Take Test", icon: FileText },
        { href: "/student/books", label: "Books", icon: BookOpen },
        { href: "/student/profile", label: "Profile", icon: User },
      ]
    : [
        { href: "/student/tests", label: "Take Test", icon: FileText },
        { href: "/student/marks", label: "Results", icon: Trophy },
        { href: "/student/attendance", label: "Attendance", icon: CalendarCheck },
        { href: "/student/batches", label: "My Batch", icon: GraduationCap },
        { href: "/student/books", label: "Books", icon: BookOpen },
        { href: "/student/profile", label: "Profile", icon: User },
      ];

  return (
    <StudentShell title={greeting(name)} subtitle={scholarship ? "Scholarship track • free tests, books and updates" : profile?.batch ? `Current batch • ${profile.batch.name}` : "Your academic overview"}>
      {/* HERO — profile completion + type badge */}
      <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-navy-800 via-navy-700 to-teal-700 p-5 text-white shadow-card sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold tracking-widest ring-1 ring-white/20">
              <FlaskConical className="h-3.5 w-3.5" /> {scholarship ? "SCHOLARSHIP STUDENT" : "REGULAR STUDENT"}
            </p>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[12px] font-bold text-silver-200">
                <span>Profile completion</span><span>{completion}%</span>
              </div>
              <div className="mt-1.5 h-2 w-56 max-w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-300 to-amber-200 transition-all duration-700" style={{ width: `${completion}%` }} />
              </div>
              {completion < 100 ? (
                <Link href="/student/profile" className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold text-teal-200 hover:text-white">
                  Complete your profile <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex gap-5 text-center">
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
              <p className="text-2xl font-extrabold">{analytics?.tests.attempted ?? (analyticsFailed ? "—" : "…")}</p>
              <p className="text-[10px] font-bold tracking-widest text-silver-200">TESTS</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
              <p className="text-2xl font-extrabold">{analytics?.tests.averagePercentage === null || analytics?.tests.averagePercentage === undefined ? "—" : `${analytics.tests.averagePercentage}%`}</p>
              <p className="text-[10px] font-bold tracking-widest text-silver-200">AVG SCORE</p>
            </div>
            {!scholarship ? (
              <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                <p className="text-2xl font-extrabold">{analytics?.attendance.percentage === null || analytics?.attendance.percentage === undefined ? "—" : `${analytics.attendance.percentage}%`}</p>
                <p className="text-[10px] font-bold tracking-widest text-silver-200">ATTENDANCE</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {quickActions.map((q) => (
          <Link key={q.href + q.label} href={q.href} className="card-lift group flex flex-col items-center gap-1.5 rounded-2xl border border-silver-200 bg-white px-2 py-3.5 text-center shadow-card transition hover:border-teal-400">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700 transition group-hover:bg-teal-500 group-hover:text-white"><q.icon className="h-5 w-5" /></span>
            <span className="text-[12px] font-bold text-navy-700">{q.label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* TESTS */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-navy-700"><FileText className="h-4 w-4" /> {scholarship ? "Scholarship & Free Tests" : "Available Tests"}</h2>
            <Link href="/student/tests" className="text-[13px] font-bold text-teal-600 hover:underline">View all →</Link>
          </div>
          {tests === null ? (
            <div className="mt-3 space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          ) : openTests.length === 0 ? (
            <p className="mt-3 rounded-xl bg-silver-50 px-4 py-6 text-center text-sm font-bold text-muted">No open tests right now.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {upcoming.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-silver-50 px-4 py-3 transition hover:bg-teal-50/60">
                  <div>
                    <p className="text-sm font-extrabold text-navy-700">{t.title}</p>
                    <p className="text-[12px] text-muted">{t.duration} min • {t.totalQuestions} Qs{t.access?.accessType === "FREE" ? " • FREE" : ""}</p>
                  </div>
                  <Link href={`/student/tests/${t.id}`} className="shrink-0 rounded-xl bg-crimson px-4 py-2 text-[13px] font-bold text-white">Start</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NOTIFICATIONS */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-navy-700">
              <Bell className="h-4 w-4" /> Notifications
              {unread > 0 ? <span className="rounded-full bg-crimson px-2 py-0.5 text-[10px] font-extrabold text-white">{unread} NEW</span> : null}
            </h2>
            <Link href="/student/notifications" className="text-[13px] font-bold text-teal-600 hover:underline">View all →</Link>
          </div>
          {feed === null ? (
            <div className="mt-3 space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : feed.length === 0 ? (
            <p className="mt-3 rounded-xl bg-silver-50 px-4 py-6 text-center text-sm font-bold text-muted">No notifications yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {feed.map((n) => (
                <li key={n.id} className="rounded-xl bg-silver-50 px-4 py-2.5 text-[13px]">
                  <span className="font-extrabold text-navy-700">{n.title} {!n.isRead ? <span className="ml-1 rounded-full bg-teal-500 px-1.5 py-px text-[9px] font-bold text-white">NEW</span> : null}</span>
                  <span className="block text-muted">{n.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!scholarship && batch ? (
        <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-card border border-teal-200 bg-teal-50/60 p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold tracking-widest text-teal-700">CURRENT BATCH</p>
            <p className="truncate text-[15px] font-extrabold text-navy-700">{batch.name}</p>
            <p className="truncate text-[12px] font-semibold text-muted">
              {[batch.course?.name, batch.status].filter(Boolean).join(" • ")}
            </p>
          </div>
          <Link href="/student/batches" className="shrink-0 rounded-xl bg-navy-700 px-4 py-2 text-[13px] font-bold text-white">
            My Batch →
          </Link>
        </div>
      ) : null}

      {/* RECENT RESULTS — server-evaluated, own rows only */}
      <div className="mt-4 rounded-card border border-silver-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-navy-700"><Trophy className="h-4 w-4" /> Recent Results</h2>
          <Link href="/student/results" className="text-[13px] font-bold text-teal-600 hover:underline">View all →</Link>
        </div>
        {recentResults === null ? (
          <div className="mt-3 space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        ) : recentResults.length === 0 ? (
          <p className="mt-3 rounded-xl bg-silver-50 px-4 py-6 text-center text-sm font-bold text-muted">
            No results yet — attempt a test and your score will appear here.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentResults.slice(0, 3).map((r) => (
              <Link key={r.id} href={`/student/tests/${r.testId}/result`} className="min-w-0 rounded-xl bg-silver-50 px-4 py-3 transition hover:bg-teal-50/60">
                <p className="truncate text-sm font-extrabold text-navy-700">{r.testTitle || "Test"}</p>
                <p className="mt-0.5 text-[12px] font-bold text-muted">{r.marks}/{r.totalMarks} • {r.percentage}%</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {!scholarship ? (
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* PERFORMANCE */}
          <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-navy-700"><BarChart3 className="h-4 w-4" /> Performance Trend</h2>
              <Link href="/student/analytics" className="text-[13px] font-bold text-teal-600 hover:underline">Analytics →</Link>
            </div>
            <div className="mt-3">
              {analytics === null && !analyticsFailed ? <Skeleton className="h-36" /> : (
                <TrendChart points={(analytics?.tests.trend ?? []).map((t) => ({ label: t.title, value: t.percentage }))} />
              )}
            </div>
            {analytics ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { l: "HIGHEST", v: analytics.tests.highest },
                  { l: "AVERAGE", v: analytics.tests.averagePercentage },
                  { l: "LOWEST", v: analytics.tests.lowest },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl bg-silver-50 px-2 py-2.5">
                    <p className="text-lg font-extrabold text-navy-700">{s.v === null ? "—" : `${s.v}%`}</p>
                    <p className="text-[10px] font-bold tracking-widest text-muted">{s.l}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {/* ATTENDANCE */}
          <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-navy-700"><CalendarCheck className="h-4 w-4" /> Attendance</h2>
            <div className="mt-3 flex flex-wrap items-center gap-5">
              {analytics === null && !analyticsFailed ? <Skeleton className="h-28 w-28 rounded-full" /> : (
                <Ring value={analytics?.attendance.percentage ?? null} size={112} label="attendance" sub={analytics ? `${analytics.attendance.present}/${analytics.attendance.total} present` : undefined} />
              )}
              <div className="min-w-48 flex-1">
                {analytics ? (
                  <Bars rows={[
                    { label: "Present", value: analytics.attendance.total ? Math.round((analytics.attendance.present / analytics.attendance.total) * 1000) / 10 : null, hint: String(analytics.attendance.present) },
                    { label: "Absent", value: analytics.attendance.total ? Math.round((analytics.attendance.absent / analytics.attendance.total) * 1000) / 10 : null, hint: String(analytics.attendance.absent) },
                    { label: "Late", value: analytics.attendance.total ? Math.round((analytics.attendance.late / analytics.attendance.total) * 1000) / 10 : null, hint: String(analytics.attendance.late) },
                    { label: "Leave", value: analytics.attendance.total ? Math.round((analytics.attendance.leave / analytics.attendance.total) * 1000) / 10 : null, hint: String(analytics.attendance.leave) },
                  ]} />
                ) : analyticsFailed ? (
                  <p className="rounded-xl bg-silver-50 px-4 py-6 text-center text-[13px] font-bold text-muted">No attendance data yet.</p>
                ) : <Skeleton className="h-24" />}
              </div>
            </div>
            <Link href="/student/attendance" className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-teal-600 hover:underline">Full attendance <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      ) : null}

      {/* RECOMMENDED BOOKS */}
      <div className="mt-4 rounded-card border border-silver-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-navy-700"><BookOpen className="h-4 w-4" /> Recommended Books</h2>
          <Link href="/student/books" className="text-[13px] font-bold text-teal-600 hover:underline">Browse all →</Link>
        </div>
        {books === null ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        ) : books.length === 0 ? (
          <p className="mt-3 rounded-xl bg-silver-50 px-4 py-6 text-center text-sm font-bold text-muted">No books in the library yet.</p>
        ) : (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {books.map((b) => (
              <Link key={b.id} href="/student/books" className="card-lift rounded-xl border border-silver-200 p-3.5 transition hover:border-teal-400">
                <p className="truncate text-sm font-extrabold text-navy-700">{b.title}</p>
                <p className="mt-0.5 truncate text-[12px] text-muted">{[b.author, b.subject].filter(Boolean).join(" • ") || "Study material"}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
      {profileLoading ? null : null}
    </StudentShell>
  );
}
