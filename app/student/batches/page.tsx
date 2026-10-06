"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Megaphone, User } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { Ring, Skeleton } from "@/components/student/charts";

interface BatchInfo {
  id: string; name: string; startDate: string | null; endDate: string | null; status: string;
  course: { id: string; name: string } | null;
  faculty: { id: string; name: string; subject: string | null; designation: string | null } | null;
}
interface Upcoming { id: string; title: string; status: string; startTime: string | null; duration: number; accessType: string; price: number }

/** Phase 14 — own batch experience (REGULAR only, read-only). */
export default function StudentBatchesPage() {
  const session = useStudentGuard();
  const [batch, setBatch] = useState<BatchInfo | null | undefined>(undefined);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [attPct, setAttPct] = useState<number | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch("/api/students/me/batches", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        if (res.ok && json?.success === true) {
          setBatch((json.data.batch ?? null) as BatchInfo | null);
          setUpcoming(json.data.upcoming ?? []);
          setAttPct(json.data.attendance?.percentage ?? null);
        } else setBatch(null);
      } catch {
        setBatch(null);
      }
    })();
  }, [session]);

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (forbidden) {
    return (
      <StudentShell title="My Batch" subtitle="Regular students">
        <p className="rounded-card bg-white p-8 text-center text-sm font-bold text-muted">Batch information is available for regular students only.</p>
      </StudentShell>
    );
  }
  if (batch === undefined) {
    return (
      <StudentShell title="My Batch" subtitle="Your batch, faculty and schedule">
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      </StudentShell>
    );
  }
  if (batch === null) {
    return (
      <StudentShell title="My Batch" subtitle="Your batch, faculty and schedule">
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No batch assigned yet. Contact the academy office.</p>
      </StudentShell>
    );
  }

  return (
    <StudentShell title={batch.name} subtitle={`${batch.course?.name ?? "Course"} • ${batch.status}`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-navy-700"><GraduationCap className="h-4 w-4" /> Batch Details</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2.5 text-[13px]">
            {[
              ["Course", batch.course?.name ?? "—"],
              ["Status", batch.status],
              ["Starts", batch.startDate ? new Date(batch.startDate).toLocaleDateString() : "—"],
              ["Ends", batch.endDate ? new Date(batch.endDate).toLocaleDateString() : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-silver-50 px-3.5 py-2.5">
                <dt className="text-[11px] font-bold tracking-widest text-muted">{k.toUpperCase()}</dt>
                <dd className="font-extrabold text-navy-700">{v}</dd>
              </div>
            ))}
          </dl>
          {batch.faculty ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-navy-800 p-4 text-white">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500"><User className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-extrabold">{batch.faculty.name}</p>
                <p className="text-[12px] text-silver-200">{[batch.faculty.designation, batch.faculty.subject].filter(Boolean).join(" • ") || "Faculty"}</p>
              </div>
            </div>
          ) : null}
          <div className="mt-3 flex items-center gap-4">
            <Ring value={attPct} size={96} label="attendance" />
            <p className="text-[13px] text-muted">Your attendance summary in this batch.</p>
          </div>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-navy-700"><Megaphone className="h-4 w-4" /> Upcoming Tests</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 rounded-xl bg-silver-50 px-4 py-6 text-center text-sm font-bold text-muted">No upcoming tests scheduled.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-silver-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-extrabold text-navy-700">{t.title}</p>
                    <p className="text-[12px] text-muted">{t.status}{t.startTime ? ` • ${new Date(t.startTime).toLocaleString()}` : ""} • {t.duration} min{t.accessType === "PAID" ? ` • ₹${t.price}` : ""}</p>
                  </div>
                  <Link href={`/student/tests/${t.id}`} className="shrink-0 rounded-xl bg-crimson px-4 py-2 text-[13px] font-bold text-white">Open</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </StudentShell>
  );
}
