"use client";

import Link from "next/link";
import { Bell, FileText, Trophy } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { getNotifications, getResults, getTests } from "@/lib/storage";
import { deriveStatus, visibleToStudents } from "@/services/testService";

export default function StudentDashboardPage() {
  const session = useStudentGuard();
  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  const tests = getTests().filter(visibleToStudents);
  const live = tests.filter((t) => ["published", "live"].includes(deriveStatus(t)));
  const scheduled = tests.filter((t) => deriveStatus(t) === "scheduled");
  const results = getResults().filter((r) => r.studentId === session.studentId);
  const notifs = getNotifications().filter((n) => n.target === "students").slice(0, 5);

  return (
    <StudentShell title={`Welcome, ${session.name}`} subtitle="Your tests, results and notifications">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-muted"><FileText className="h-3.5 w-3.5" /> LIVE TESTS</p>
          <p className="mt-1 text-3xl font-extrabold text-teal-600">{live.length}</p>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-muted"><FileText className="h-3.5 w-3.5" /> UPCOMING</p>
          <p className="mt-1 text-3xl font-extrabold text-navy-700">{scheduled.length}</p>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-muted"><Trophy className="h-3.5 w-3.5" /> COMPLETED</p>
          <p className="mt-1 text-3xl font-extrabold text-navy-700">{results.length}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold text-navy-700">Available Tests</h2>
            <Link href="/student/tests" className="text-[13px] font-bold text-teal-600 hover:underline">View all →</Link>
          </div>
          {live.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No live tests right now. Ask your admin to publish one from <code>/admin/tests</code>.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {live.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-silver-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-extrabold text-navy-700">{t.name}</p>
                    <p className="text-[12px] text-muted">{t.questionIds.length} Qs • {t.durationMinutes} min • {t.marksPerQuestion} marks each</p>
                  </div>
                  <Link href={`/student/tests/${t.id}`} className="shrink-0 rounded-xl bg-crimson-DEFAULT px-4 py-2 text-[13px] font-bold text-white">Start Test</Link>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-navy-700"><Bell className="h-4 w-4" /> Notifications</h2>
          {notifs.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No notifications yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {notifs.map((n) => (
                <li key={n.id} className="rounded-xl bg-silver-50 px-4 py-2.5 text-[13px]">
                  <span className="font-extrabold text-navy-700">{n.title}</span>
                  <span className="block text-muted">{n.message}</span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mt-4 text-[15px] font-extrabold text-navy-700">Recent Results</h2>
          {results.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No attempts yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {results.slice(0, 3).map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-xl bg-silver-50 px-4 py-2.5 text-[13px]">
                  <span className="font-bold text-navy-700">{r.testName}</span>
                  <Link href={`/student/tests/${r.testId}/result`} className="font-extrabold text-teal-600 hover:underline">{r.marks}/{r.maxMarks} ({r.percentage}%)</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </StudentShell>
  );
}
