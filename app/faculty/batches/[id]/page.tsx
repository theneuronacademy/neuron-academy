"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";

interface BatchDetail {
  id: string;
  name: string;
  course: string;
  studentCount: number;
  startDate: string;
  endDate: string;
  status: string;
}

interface StudentRow {
  id: string;
  studentId: string;
  name: string;
  status: string;
  attendancePct: number | null;
}

export default function FacultyBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [batch, setBatch] = React.useState<BatchDetail | null>(null);
  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [ready, setReady] = React.useState(false);
  const [forbidden, setForbidden] = React.useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const p = await params;
      if (!live) return;
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      const [bR, sR] = await Promise.all([
        fetch("/api/faculty/batches", { cache: "no-store" }),
        fetch(`/api/faculty/students?batchId=${encodeURIComponent(p.id)}`, { cache: "no-store" }),
      ]);
      if (!live) return;
      if (sR.status === 403) { setForbidden(true); setReady(true); return; }
      const bJ = await bR.json().catch(() => null);
      const found = (bJ?.data?.items ?? []).find((b: BatchDetail) => b.id === p.id) ?? null;
      if (!found) { setForbidden(true); setReady(true); return; }
      setBatch(found);
      const sJ = await sR.json().catch(() => null);
      if (sR.ok && sJ?.success && Array.isArray(sJ.data?.items)) setStudents(sJ.data.items);
      setReady(true);
    })();
    return () => { live = false; };
  }, [params, router]);

  if (!ready) {
    return (
      <FacultyShell title="Batch" subtitle="Loading batch">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading batch</p>
      </FacultyShell>
    );
  }

  if (forbidden || !batch) {
    return (
      <FacultyShell title="Batch" subtitle="Access restricted">
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">This batch is not assigned to you.</p>
        <Link href="/faculty/batches" className="mt-3 block text-center text-[13px] font-bold text-teal-600 hover:underline">Back to My Batches</Link>
      </FacultyShell>
    );
  }

  return (
    <FacultyShell title={batch.name} subtitle={batch.course}>
      <div className="grid gap-2 sm:grid-cols-3">
        <Link href={`/faculty/attendance?batchId=${batch.id}`} className="rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-navy-800">Mark Attendance</Link>
        <Link href={`/faculty/students?batchId=${batch.id}`} className="rounded-xl border border-silver-300 px-4 py-2.5 text-center text-sm font-bold text-navy-700 hover:border-teal-500">View Students</Link>
        <Link href="/faculty/tests" className="rounded-xl border border-silver-300 px-4 py-2.5 text-center text-sm font-bold text-navy-700 hover:border-teal-500">Manage Tests</Link>
      </div>
      <div className="mt-4 rounded-card border border-silver-200 bg-white p-5 shadow-card">
        <p className="text-[15px] font-extrabold text-navy-700">Students ({students.length})</p>
        {students.length === 0 ? (
          <p className="mt-2 text-sm font-bold text-muted">No students in this batch.</p>
        ) : (
          <ul className="mt-3 divide-y divide-silver-100">
            {students.slice(0, 20).map((st) => (
              <li key={st.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-navy-700">{st.name}</p>
                  <p className="text-[12px] text-muted">{st.studentId}</p>
                </div>
                <p className="shrink-0 text-[12px] font-bold text-muted">{st.attendancePct == null ? "—" : `${st.attendancePct}%`}</p>
              </li>
            ))}
          </ul>
        )}
        {students.length > 20 ? <p className="mt-2 text-[12px] text-muted">Showing 20 of {students.length}. Open Students for full list.</p> : null}
      </div>
    </FacultyShell>
  );
}
