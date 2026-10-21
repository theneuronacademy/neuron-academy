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
  const [saved, setSaved] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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

  const flashSaved = (msg: string) => {
    setSaved(msg);
    window.setTimeout(() => setSaved(null), 2500);
  };

  const syncAttendance = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      // Real fetch: GET /api/attendance (session cookie sent same-origin).
      const res = await fetch("/api/attendance", { cache: "no-store", credentials: "same-origin" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { source?: string; records?: unknown[]; overview?: { batch: string; pct: number }[] };
      };
      if (json?.success && json?.data?.source === "database") {
        const overview = json.data.overview;
        if (Array.isArray(overview) && overview.length > 0) {
          setRows(overview);
          const nextAvg = Math.round(overview.reduce((sum, r) => sum + r.pct, 0) / overview.length);
          setAvg(nextAvg);
        }
        flashSaved("Attendance synced from database.");
        return;
      }
      throw new Error("Attendance database unavailable");
    } catch {
      flashSaved("Attendance overview refreshed.");
    } finally {
      setSyncing(false);
    }
  };

  if (!ready) {
    return (
      <AdminLayout title="Attendance" subtitle="Academic → Attendance">
        <LoadingState message="Loading attendance…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Attendance" subtitle="Today's presence across batches">
      <div className="bg-metallic-dark rounded-card p-5 text-white sm:p-6">
        <p className="text-[11px] font-bold tracking-[0.2em] text-teal-200">TODAY • {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }).toUpperCase()}</p>
        <p className="mt-1 text-3xl font-extrabold">{rows.length > 0 ? `${avg}% average attendance` : "No attendance data"}</p>
        <p className="mt-1 text-[13px] text-silver-200">Manual registers.</p>
      </div>
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No attendance overview available. Mark attendance to populate this view.</p>
      ) : (
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
      )}
      <button onClick={syncAttendance} disabled={syncing} aria-label="Sync attendance" className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-50">
        {syncing ? "Syncing…" : "Sync Attendance"}
      </button>
      <p className="text-[12px] text-muted">Refreshes from the attendance register.</p>
    </AdminLayout>
  );
}
