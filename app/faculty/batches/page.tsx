"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Users, Clock } from "lucide-react";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { cn } from "@/lib/utils";

interface BatchRow {
  id: string;
  name: string;
  course: string;
  studentCount: number;
  startDate: string;
  endDate: string;
  status: string;
}

export default function FacultyBatchesPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<BatchRow[]>([]);
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      const sj = await s.json().catch(() => null);
      const u = sj?.data?.user;
      if (!u || (u.role !== "FACULTY" && u.role !== "ADMIN")) { router.replace("/faculty/login"); return; }
      const r = await fetch("/api/faculty/batches", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (live && r.ok && j?.success && Array.isArray(j.data?.items)) setRows(j.data.items);
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, [router]);

  if (!ready) {
    return (
      <FacultyShell title="My Batches" subtitle="Batches assigned to you">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading batches</p>
      </FacultyShell>
    );
  }

  return (
    <FacultyShell title="My Batches" subtitle={`${rows.length} assigned batches`}>
      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No batches assigned yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
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
      <div className="mt-4 flex items-center gap-2 text-[12px] text-muted">
        <Layers className="h-4 w-4" />
        <span>Only batches assigned to you are visible. Changing the URL to another batch returns 403/404.</span>
      </div>
    </FacultyShell>
  );
}
