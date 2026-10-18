// Faculty Dashboard Page - Enhanced with React Query hooks
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Users, FileText, CalendarCheck, Bell, Clock } from "lucide-react";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { useDashboardStats, useFacultyBatches, useFacultyTests, useFacultyActivity, useFacultyNotifications, useFacultyAnalytics } from "@/lib/faculty-hooks";
import { cn } from "@/lib/utils";

interface UpcomingTest {
  id: string;
  title: string;
  batch: string;
  date: string;
  time: string;
  status: string;
}

interface ActivityItem {
  id: string;
  text: string;
  time: string;
  type: string;
}

interface NotifItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function FacultyDashboardPage() {
  const router = useRouter();

  const { data: batches, isLoading: batchesLoading } = useFacultyBatches();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: testsData, isLoading: testsLoading } = useFacultyTests();
  const { data: activity, isLoading: activityLoading } = useFacultyActivity(10);
  const { data: notifications, isLoading: notifsLoading } = useFacultyNotifications(10);
  const { data: analytics, isLoading: analyticsLoading } = useFacultyAnalytics();

  const isLoading = batchesLoading || statsLoading || testsLoading || activityLoading || notifsLoading || analyticsLoading;

  const tests: UpcomingTest[] = React.useMemo(() => {
    if (!testsData) return [];
    return testsData.slice(0, 5).map((t) => ({
      id: t.id,
      title: t.title,
      batch: t.batch,
      date: t.startTime ? new Date(t.startTime).toLocaleDateString() : "—",
      time: t.startTime ? new Date(t.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
      status: t.status,
    }));
  }, [testsData]);

  const notifs = React.useMemo(() => {
    if (!notifications) return [];
    return notifications.items?.slice(0, 5) ?? [];
  }, [notifications]);

  const unread = React.useMemo(() => {
    if (!notifications) return 0;
    return notifications.unreadCount ?? 0;
  }, [notifications]);

  const atRisk = React.useMemo(() => {
    if (!analytics?.rows) return 0;
    return analytics.rows.filter((r) => (r.attendancePct != null && r.attendancePct < 75) || (r.avgScore != null && r.avgScore < 40)).length;
  }, [analytics]);

  const cards = [
    { label: "My Batches", value: stats?.totalBatches ?? batches?.length ?? 0 },
    { label: "Total Students", value: stats?.totalStudents ?? 0 },
    { label: "Upcoming Tests", value: stats?.upcomingTests ?? tests.length },
    { label: "Pending Evaluations", value: stats?.pendingEvaluations ?? 0 },
  ];

  if (isLoading) {
    return (
      <FacultyShell title="Dashboard" subtitle="Loading your workspace">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading faculty area</p>
      </FacultyShell>
    );
  }

  return (
    <FacultyShell title="Dashboard" subtitle="Your academic workspace">
      {batches && batches.length > 0 ? (
        <Link
          href={`/faculty/attendance?batchId=${batches[0].id}`}
          className="mb-4 flex items-center justify-between gap-3 rounded-card bg-gradient-to-r from-teal-600 to-navy-700 px-5 py-4 text-white shadow-card transition hover:brightness-105"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold tracking-widest text-white/80">TODAY&apos;S ATTENDANCE — ONE TAP</p>
            <p className="truncate text-[16px] font-extrabold">{batches[0].name} · {batches[0].studentCount} students</p>
          </div>
          <span className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-teal-700">Mark Now →</span>
        </Link>
      ) : null}

      {atRisk > 0 ? (
        <Link href="/faculty/analytics" className="mb-4 flex items-center justify-between gap-3 rounded-card border border-amber-300 bg-amber-50 px-5 py-3.5">
          <p className="text-sm font-extrabold text-amber-800">⚠ {atRisk} student{atRisk === 1 ? "" : "s"} need{atRisk === 1 ? "s" : ""} attention (attendance {"<"} 75% or avg {"<"} 40%)</p>
          <span className="shrink-0 text-[13px] font-bold text-amber-700 underline">View →</span>
        </Link>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold tracking-widest text-muted">{c.label.toUpperCase()}</p>
            <p className="mt-1 text-3xl font-extrabold text-navy-700">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-card border border-silver-200 bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-[15px] font-extrabold text-navy-700">
            <Layers className="h-4 w-4 text-teal-600" /> Assigned Batches
          </p>
          <Link href="/faculty/batches" className="text-[12px] font-bold text-teal-600 hover:underline">View all</Link>
        </div>
        {batches?.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-silver-300 p-8 text-center text-sm font-bold text-muted">No batches assigned yet. Ask the admin to assign you in People to Batches.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {batches!.map((b) => (
              <Link key={b.id} href={`/faculty/batches/${b.id}`} className="rounded-card border border-silver-200 bg-white p-4 shadow-card transition hover:border-teal-300 hover:shadow-lg">
                <p className="font-extrabold text-navy-700">{b.name}</p>
                <p className="text-[12px] text-muted">{b.course}</p>
                <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
                  <Users className="h-3.5 w-3.5" />
                  <span className="font-semibold text-navy-700">{b.studentCount}</span>
                  <span>students</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{b.startDate} to {b.endDate || "ongoing"}</span>
                </div>
                <span className={cn("mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold", b.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-silver-100 text-muted")}>{b.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[15px] font-extrabold text-navy-700"><FileText className="h-4 w-4 text-teal-600" /> Upcoming Tests</p>
            <Link href="/faculty/tests" className="text-[12px] font-bold text-teal-600 hover:underline">View all</Link>
          </div>
          {tests.length === 0 ? (
            <p className="py-4 text-center text-sm font-bold text-muted">No upcoming tests scheduled</p>
          ) : (
            <ul className="space-y-2.5">
              {tests.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-silver-200 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-navy-700">{t.title}</p>
                    <p className="text-[12px] text-muted">{t.batch} | {t.date} {t.time}</p>
                  </div>
                  <span className="rounded-full bg-silver-100 px-2.5 py-1 text-[11px] font-bold text-muted">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[15px] font-extrabold text-navy-700"><Bell className="h-4 w-4 text-teal-600" /> Notifications {unread > 0 ? `(${unread} unread)` : ""}</p>
            <Link href="/faculty/notifications" className="text-[12px] font-bold text-teal-600 hover:underline">View all</Link>
          </div>
          {notifs.length === 0 ? (
            <p className="py-4 text-center text-sm font-bold text-muted">No notifications</p>
          ) : (
            <ul className="space-y-2.5">
              {notifs.map((n) => (
                <li key={n.id} className="rounded-xl border border-silver-200 px-3.5 py-2.5">
                  <p className="text-sm font-extrabold text-navy-700">{n.title} {!n.isRead && <span className="ml-1 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span>}</p>
                  <p className="truncate text-[12px] text-muted">{n.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-card border border-silver-200 bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-[15px] font-extrabold text-navy-700"><CalendarCheck className="h-4 w-4 text-teal-600" /> Recent Activity</p>
        </div>
        {activity?.length === 0 ? (
          <p className="py-4 text-center text-sm font-bold text-muted">No recent activity yet. Mark attendance or publish a test to see it here.</p>
        ) : (
          <ul className="space-y-2.5">
            {activity!.slice(0, 8).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-silver-200 px-3.5 py-2.5">
                <p className="truncate text-sm font-bold text-navy-700">{a.text}</p>
                <p className="shrink-0 text-[11px] text-muted">{a.time}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Link href="/faculty/attendance" className="rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-navy-800">Mark Attendance</Link>
          <Link href="/faculty/students" className="rounded-xl border border-silver-300 px-4 py-2.5 text-center text-sm font-bold text-navy-700 hover:border-teal-500">View Students</Link>
          <Link href="/faculty/results" className="rounded-xl border border-silver-300 px-4 py-2.5 text-center text-sm font-bold text-navy-700 hover:border-teal-500">Review Results</Link>
        </div>
      </div>
    </FacultyShell>
  );
}