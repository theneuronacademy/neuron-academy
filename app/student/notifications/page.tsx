"use client";

import Link from "next/link";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { getNotifications, markNotificationRead } from "@/lib/storage";

export default function StudentNotificationsPage() {
  const session = useStudentGuard();
  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  const notifs = getNotifications().filter((n) => n.target === "students");

  return (
    <StudentShell title="Notifications" subtitle="Tests, results and announcements">
      {notifs.length === 0 ? (
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No notifications yet.</p>
      ) : (
        <ul className="grid gap-3">
          {notifs.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <div>
                <p className="text-sm font-extrabold text-navy-700">{n.title} {!n.read ? <span className="ml-1 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span> : null}</p>
                <p className="mt-0.5 text-[13px] text-muted">{n.message}</p>
                <p className="mt-1 text-[11px] text-muted">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                {n.testId ? <Link href={`/student/tests/${n.testId}`} className="rounded-lg bg-navy-700 px-3 py-1.5 text-center text-[12px] font-bold text-white">Open</Link> : null}
                {!n.read ? <button onClick={() => { markNotificationRead(n.id); window.location.reload(); }} className="rounded-lg border border-silver-300 px-3 py-1.5 text-[12px] font-bold">Mark read</button> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </StudentShell>
  );
}
