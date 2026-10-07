"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Users, FileText, CalendarCheck, Bell, Clock } from "lucide-react";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { cn } from "@/lib/utils";

interface FacultyBatch {
  id: string;
  name: string;
  course: string;
  studentCount: number;
  startDate: string;
  endDate: string;
  status: string;
}

interface DashboardStats {
  totalBatches: number;
  totalStudents: number;
  upcomingTests: number;
  pendingEvaluations: number;
  attendanceRate: number | null;
}

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
  const [ready, setReady] = React.useState(false);
  const [batches, setBatches] = React.useState<FacultyBatch[]>([]);
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [tests, setTests] = React.useState<UpcomingTest[]>([]);
  const [activity, setActivity] = React.useState<ActivityItem[]>([]);
  const [notifs, setNotifs] = React.useState<NotifItem[]>([]);
  const [unread, setUnread] = React.useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const s = await fetch("/api/auth/session", { cache: "no-store" });
        if (!s.ok) { router.replace("/faculty/login"); return; }
        const sj = await s.json().catch(() => null);
        const u = sj?.data?.user;
        if (!u || (u.role !== "FACULTY" && u.role !== "ADMIN")) { router.replace("/faculty/login"); return; }
        const [bR, dR, tR, aR, nR] = await Promise.all([
          fetch("/api/faculty/batches", { cache: "no-store" }),
          fetch("/api/faculty/dashboard", { cache: "no-store" }),
          fetch("/api/tests", { cache: "no-store" }),
          fetch("/api/faculty/activity", { cache: "no-store" }),
          fetch("/api/notifications/mine", { cache: "no-store" }),
        ]);
        if (!live) return;
        const bJ = await bR.json().catch(() => null);
        if (bR.ok && bJ?.success && Array.isArray(bJ.data?.items)) setBatches(bJ.data.items);
        const dJ = await dR.json().catch(() => null);
        if (dR.ok && dJ?.success && dJ.data) setStats(dJ.data);
        const tJ = await tR.json().catch(() => null);
        if (tR.ok && tJ?.success && Array.isArray(tJ.data?.items)) {
          setTests(tJ.data.items.slice(0, 5).map((t: { id: string; title: string; batch?: { name?: string }; startTime?: string; status: string }) => ({
            id: String(t.id), title: String(t.title), batch: String(t.batch?.name ?? "—"),
            date: t.startTime ? new Date(t.startTime).toLocaleDateString() : "—",
            time: t.startTime ? new Date(t.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
            status: String(t.status),
          })));
        }
        const aJ = await aR.json().catch(() => null);
        if (aR.ok && aJ?.success && Array.isArray(aJ.data?.items)) setActivity(aJ.data.items);
        const nJ = await nR.json().catch(() => null);
        if (nR.ok && nJ?.success && Array.isArray(nJ.data?.items)) {
          setNotifs(nJ.data.items.slice(0, 5));
          if (typeof nJ.data.unreadCount === "number") setUnread(nJ.data.unreadCount);
        }
      } catch {
        router.replace("/faculty/login");
        return;
      }
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, [router]);

  if (!ready) {
    return (
      <FacultyShell title="Dashboard" subtitle="Loading your workspace">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading faculty area</p>
      </FacultyShell>
    );
  }

  const cards = [
    { label: "My Batches", value: stats?.totalBatches ?? batches.length },
    { label: "Total Students", value: stats?.totalStudents ?? 0 },
    { label: "Upcoming Tests", value: stats?.upcomingTests ?? tests.length },
    { label: "Pending Evaluations", value: stats?.pendingEvaluations ?? 0 },
  ];

  return (
    <FacultyShell title="Dashboard" subtitle="Your academic workspace">
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
        {batches.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-silver-300 p-8 text-center text-sm font-bold text-muted">No batches assigned yet. Ask the admin to assign you in People to Batches.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {batches.map((b) => (
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
                  <p className="text-sm font-extrabold text-navy-700">{n.title}</p>
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
        {activity.length === 0 ? (
          <p className="py-4 text-center text-sm font-bold text-muted">No recent activity yet. Mark attendance or publish a test to see it here.</p>
        ) : (
          <ul className="space-y-2.5">
            {activity.slice(0, 8).map((a) => (
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
