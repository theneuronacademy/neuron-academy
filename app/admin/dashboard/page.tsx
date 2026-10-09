"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  GraduationCap,
  Layers,
  FileText,
  Inbox,
  CalendarCheck,
  UserPlus,
  UserRoundPlus,
  PlusCircle,
  Megaphone,
  ImagePlus,
  CheckCircle2,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatCard } from "@/components/admin/StatCard";
import { QuickAction } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { LoadingState } from "@/components/admin/AdminStates";
import { ProgressBar } from "@/components/ui/primitives";
import {
  getAttendanceOverview,
  getDashboardStats,
  getEnquiries,
  getRecentActivity,
  getUpcomingTests,
  getWebsiteStatus,
} from "@/services/adminApi";
import type { AdminEnquiry, AdminTest, DashboardStats } from "@/data/admin";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<{ id: string; text: string; time: string }[]>([]);
  const [upcoming, setUpcoming] = useState<AdminTest[]>([]);
  const [enquiries, setEnquiries] = useState<AdminEnquiry[]>([]);
  const [attendance, setAttendance] = useState<{ batch: string; pct: number }[]>([]);
  const [site, setSite] = useState<{ online: boolean; lastUpdate: string; activeBanners: number; activePopups: number } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // Phase 6: live database test-platform stats (hidden in demo mode).
  const [liveStats, setLiveStats] = useState<{ totalTests: number; publishedTests: number; liveTests: number; scheduledTests: number; completedTests: number; totalResults: number; totalAttempts: number; totalStudents: number; activeStudents: number; totalFaculty: number; activeFaculty: number; totalBatches: number; activeBatches: number; totalCourses: number; newEnquiries: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) {
          router.replace("/admin/login");
          return;
        }
        const json = await res.json();
        const u = json?.data?.user;
        if (!u || u.role !== "ADMIN") {
          router.replace("/admin/login");
          return;
        }
        setStats(await getDashboardStats());
        setActivity(await getRecentActivity());
        setUpcoming(await getUpcomingTests());
        setEnquiries((await getEnquiries()).slice(0, 5));
        setAttendance(await getAttendanceOverview());
        setSite(await getWebsiteStatus());
        try {
          const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
          const json = await res.json().catch(() => null);
          if (res.ok && json?.success === true && typeof json.data?.totalTests === "number") setLiveStats(json.data);
        } catch {
          /* demo mode — demo cards below stay */
        }
        setReady(true);
      } catch {
        router.replace("/admin/login");
      }
    })();
  }, [router]);

  if (!ready || !stats) {
    return (
      <AdminLayout title="Dashboard" subtitle="Academy overview">
        <LoadingState message="Loading dashboard…" />
      </AdminLayout>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const quick = (msg: string) => {
    setSaved(msg);
    window.setTimeout(() => setSaved(null), 2500);
  };

  return (
    <AdminLayout title="Dashboard" subtitle="Academy control center">
      {/* Welcome */}
      <div className="metallic-dark flex flex-wrap items-center justify-between gap-4 rounded-card p-5 text-white sm:p-6">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-teal-200">{today.toUpperCase()}</p>
          <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">{greeting()}, Admin</h2>
          <p className="mt-1 text-[13px] text-silver-200">
            {liveStats
              ? `${liveStats.activeBatches} active batches • ${liveStats.publishedTests} published tests • website online`
              : "Connecting to live academy data…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/students" className="rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-navy-700 hover:bg-silver-100">
            + Add Student
          </Link>
          <Link href="/admin/tests" className="rounded-xl bg-teal-500 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-teal-400">
            + Create Test
          </Link>
          <Link href="/admin/website/banners" className="rounded-xl bg-white/10 px-4 py-2.5 text-[13px] font-bold ring-1 ring-white/25 hover:bg-white/20">
            + Add Banner
          </Link>
        </div>
      </div>
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}

      {/* Stats — Phase 17: live database values; demo fallbacks labelled. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Students" value={liveStats?.totalStudents ?? stats.totalStudents} sub={liveStats ? `${liveStats.activeStudents} active` : "Demo data"} icon={Users} accent="navy" />
        <StatCard label="Total Faculty" value={liveStats?.totalFaculty ?? stats.totalFaculty} sub={liveStats ? `${liveStats.activeFaculty} active` : "Demo data"} icon={GraduationCap} accent="teal" />
        <StatCard label="Active Batches" value={liveStats?.activeBatches ?? stats.activeBatches} sub={liveStats ? `Across ${liveStats.totalCourses} courses` : "Demo data"} icon={Layers} accent="navy" />
        <StatCard label="Published Tests" value={liveStats?.publishedTests ?? stats.publishedTests} sub={liveStats ? `${liveStats.liveTests} live now` : "Demo data"} icon={FileText} accent="teal" />
        <StatCard label="Pending Enquiries" value={liveStats?.newEnquiries ?? stats.pendingEnquiries} sub={liveStats ? "New enquiries awaiting contact" : "Demo data"} icon={Inbox} accent="crimson" />
        <StatCard label="Today's Attendance" value={`${stats.todayAttendancePct}%`} sub="Demo preview — see Attendance" icon={CalendarCheck} accent="teal" />
      </div>

      {/* Phase 6: live database test-platform stats (demo cards above stay as fallback) */}
      {liveStats ? (
        <div>
          <h3 className="text-sm font-extrabold tracking-widest text-muted">LIVE TEST PLATFORM • POSTGRESQL</h3>
          <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total Tests" value={liveStats.totalTests} sub="Database count" icon={FileText} accent="navy" />
            <StatCard label="Published Tests" value={liveStats.publishedTests} sub={`${liveStats.liveTests} live now`} icon={Megaphone} accent="teal" />
            <StatCard label="Upcoming Tests" value={liveStats.scheduledTests} sub={`${liveStats.completedTests} completed`} icon={CalendarCheck} accent="navy" />
            <StatCard label="Total Results" value={liveStats.totalResults} sub={`${liveStats.totalAttempts} attempts`} icon={CheckCircle2} accent="teal" />
          </div>
        </div>
      ) : null}

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-extrabold tracking-widest text-muted">QUICK ACTIONS</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <QuickAction icon={UserPlus} label="Add Student" desc="Enroll a learner" onClick={() => router.push("/admin/students")} />
          <QuickAction icon={UserRoundPlus} label="Add Faculty" desc="Onboard a mentor" onClick={() => router.push("/admin/faculty")} />
          <QuickAction icon={PlusCircle} label="Create Test" desc="Live / offline / practice" onClick={() => router.push("/admin/tests")} />
          <QuickAction icon={Megaphone} label="Publish Announcement" desc="Top running banner" onClick={() => router.push("/admin/website/announcements")} />
          <QuickAction icon={ImagePlus} label="Add Banner" desc="Promo without code" onClick={() => router.push("/admin/website/banners")} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming tests */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-extrabold text-navy-700">Upcoming Tests</h3>
            <Link href="/admin/tests" className="text-[12px] font-bold text-teal-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-2.5">
            {upcoming.length === 0 ? (
              <p className="rounded-xl bg-silver-50 px-4 py-6 text-center text-[13px] font-bold text-muted">No upcoming tests.</p>
            ) : (
            upcoming.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-silver-200 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-navy-700">{t.name}</p>
                  <p className="text-[12px] text-muted">
                    {t.batch} • {t.date} • {t.time}
                  </p>
                </div>
                <AdminStatusBadge tone={statusToneFor(t.status)}>{t.status}</AdminStatusBadge>
              </div>
            ))
            )}
          </div>
        </div>

        {/* Recent enquiries */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-extrabold text-navy-700">Recent Enquiries</h3>
            <Link href="/admin/enquiries" className="text-[12px] font-bold text-teal-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-2.5">
            {enquiries.length === 0 ? (
              <p className="rounded-xl bg-silver-50 px-4 py-6 text-center text-[13px] font-bold text-muted">No enquiries yet.</p>
            ) : (
            enquiries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-silver-200 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-navy-700">{e.name}</p>
                  <p className="truncate text-[12px] text-muted">
                    {e.course} • {e.phone}
                  </p>
                </div>
                <AdminStatusBadge tone={statusToneFor(e.status)}>{e.status}</AdminStatusBadge>
              </div>
            ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Attendance */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card lg:col-span-1">
          <h3 className="text-[15px] font-extrabold text-navy-700">Attendance Overview</h3>
          <p className="mt-0.5 text-[12px] font-semibold text-muted">Today • {stats.todayAttendancePct}% average (demo preview)</p>
          <div className="mt-4 space-y-3">
            {attendance.length === 0 ? (
              <p className="rounded-xl bg-silver-50 px-4 py-6 text-center text-[13px] font-bold text-muted">No attendance data.</p>
            ) : (
            attendance.map((a) => (
              <div key={a.batch}>
                <div className="flex items-center justify-between text-[12px] font-bold">
                  <span className="text-navy-700">{a.batch}</span>
                  <span className="text-muted">{a.pct}%</span>
                </div>
                <ProgressBar value={a.pct} className="mt-1.5" tone={a.pct >= 85 ? "teal" : a.pct >= 75 ? "navy" : "red"} />
              </div>
            ))
            )}
          </div>
          <Link href="/admin/attendance" className="mt-4 block rounded-xl border border-silver-300 px-4 py-2 text-center text-[13px] font-bold text-navy-700 hover:border-teal-500">
            Open Attendance
          </Link>
        </div>

        {/* Recent activity */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card lg:col-span-1">
          <h3 className="text-[15px] font-extrabold text-navy-700">Recent Activity</h3>
          {activity.length === 0 ? (
            <p className="mt-3 rounded-xl bg-silver-50 px-4 py-6 text-center text-[13px] font-bold text-muted">No recent activity.</p>
          ) : (
          <ul className="mt-3 space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-hidden />
                <div>
                  <p className="text-[13px] font-bold text-navy-700">{a.text}</p>
                  <p className="text-[11px] font-semibold text-muted">{a.time}</p>
                </div>
              </li>
            ))}
          </ul>
          )}
        </div>

        {/* Website status */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card lg:col-span-1">
          <h3 className="text-[15px] font-extrabold text-navy-700">Website Status</h3>
          <div className="mt-3 space-y-2.5 text-[13px] font-semibold">
            <div className="flex items-center justify-between rounded-xl bg-silver-50 px-3.5 py-2.5">
              <span className="text-muted">Website</span>
              <AdminStatusBadge tone={site?.online ? "green" : "red"}>{site?.online ? "Online" : "Offline"}</AdminStatusBadge>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-silver-50 px-3.5 py-2.5">
              <span className="text-muted">Active banners</span>
              <span className="font-extrabold text-navy-700">{site?.activeBanners}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-silver-50 px-3.5 py-2.5">
              <span className="text-muted">Active popups</span>
              <span className="font-extrabold text-navy-700">{site?.activePopups}</span>
            </div>
            <p className="px-1 text-[12px] text-muted">Last content update: {site?.lastUpdate}</p>
          </div>
          <Link href="/admin/website" className="mt-4 block rounded-xl bg-navy-700 px-4 py-2 text-center text-[13px] font-bold text-white hover:bg-navy-800">
            Manage Website
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
