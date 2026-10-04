"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingState } from "@/components/admin/AdminStates";
import { ProgressBar } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getAttendanceOverview, getDashboardStats } from "@/services/adminApi";

export default function AttendancePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<{ batch: string; pct: number }[]>([]);
  const [avg, setAvg] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      setRows(await getAttendanceOverview());
      setAvg((await getDashboardStats()).todayAttendancePct);
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <AdminLayout title="Attendance" subtitle="Academic → Attendance">
        <LoadingState message="Loading attendance…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Attendance" subtitle="Today's presence across batches">
      <div className="metallic-dark rounded-card p-5 text-white sm:p-6">
        <p className="text-[11px] font-bold tracking-[0.2em] text-teal-200">TODAY • OCT 3, 2026</p>
        <p className="mt-1 text-3xl font-extrabold">{avg}% average attendance</p>
        <p className="mt-1 text-[13px] text-silver-200">Synced from biometric + manual registers (demo values).</p>
      </div>
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Attendance synced (demo).
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((a) => (
          <div key={a.batch} className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-extrabold text-navy-700">{a.batch}</p>
              <p className="text-lg font-extrabold text-navy-700">{a.pct}%</p>
            </div>
            <ProgressBar value={a.pct} className="mt-3" tone={a.pct >= 85 ? "teal" : a.pct >= 75 ? "navy" : "red"} />
            <p className="mt-2 text-[12px] font-semibold text-muted">{a.pct >= 85 ? "Healthy" : a.pct >= 75 ? "Watch" : "Needs follow-up"}</p>
          </div>
        ))}
      </div>
      <button onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 2500); }} className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-800">
        Sync Attendance (demo)
      </button>
      <p className="text-[12px] text-muted">Biometric + mobile-app sync arrives with the backend integration phase.</p>
    </AdminLayout>
  );
}
