"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Layers, LogOut, PenSquare, Users, Clock } from "lucide-react";
import { OfflineMarksForm } from "@/components/admin/OfflineMarksForm";
import { isDbLive } from "@/services/dbLive";
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

/**
 * Faculty dashboard — Phase 5: assigned batches, students, marks entry, attendance.
 * Guarded by the server session (middleware) + this client check.
 */
export default function FacultyDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [dbLive, setDbLive] = useState(false);
  const [batches, setBatches] = useState<FacultyBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<FacultyBatch | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) {
          router.replace("/faculty/login");
          return;
        }
        const json = await res.json();
        const u = json?.data?.user;
        if (!u || (u.role !== "FACULTY" && u.role !== "ADMIN")) {
          router.replace("/faculty/login");
          return;
        }
        setUser(u);
        void isDbLive().then(setDbLive).catch(() => null);
        
        // Fetch assigned batches for this faculty
        const batchesRes = await fetch("/api/batches?facultyId=" + u.id, { cache: "no-store" });
        if (batchesRes.ok) {
          const batchesJson = await batchesRes.json().catch(() => null);
          if (batchesJson?.success && Array.isArray(batchesJson.data?.items)) {
            setBatches(batchesJson.data.items);
          }
        }
      } catch {
        router.replace("/faculty/login");
        return;
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading faculty area…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="metallic-dark px-4 py-8 text-white sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-navy-700">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">Welcome, {user?.name}</h1>
              <p className="text-[13px] text-silver-200">{user?.email} • {user?.role}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST" });
              } catch {
                /* ignore */
              }
              router.push("/faculty/login");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-[13px] font-bold ring-1 ring-white/25 hover:bg-white/20"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </div>
      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6 sm:px-6">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card md:col-span-2 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <p className="flex items-center gap-2 text-[15px] font-extrabold text-navy-700">
              <Layers className="h-4 w-4 text-teal-600" /> Assigned Batches
            </p>
            {dbLive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Database Connected
              </span>
            )}
          </div>
          {batches.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-silver-300 bg-white p-8 text-center">
              <Layers className="h-10 w-10 mx-auto text-silver-300" />
              <p className="mt-3 text-sm font-bold text-muted">No batches assigned yet</p>
              <p className="mt-1 text-[12px] text-muted">Ask the admin to assign you to batches in the People → Batches section.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className={cn(
                    "rounded-card border bg-white p-4 shadow-card transition-all hover:shadow-lg cursor-pointer",
                    selectedBatch?.id === batch.id
                      ? "border-teal-400 ring-2 ring-teal-100"
                      : "border-silver-200 hover:border-teal-300"
                  )}
                  onClick={() => setSelectedBatch(selectedBatch?.id === batch.id ? null : batch)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold text-navy-700">{batch.name}</p>
                      <p className="text-[12px] text-muted">{batch.course}</p>
                    </div>
                    <AdminStatusBadge tone={batch.status === "active" ? "green" : batch.status === "upcoming" ? "blue" : "gray"}>
                      {batch.status}
                    </AdminStatusBadge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                    <div className="flex items-center gap-1.5 text-muted">
                      <Users className="h-3.5 w-3.5" />
                      <span className="font-semibold text-navy-700">{batch.studentCount}</span>
                      <span className="text-muted">students</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{batch.startDate} → {batch.endDate || "ongoing"}</span>
                    </div>
                  </div>
                  {selectedBatch?.id === batch.id && (
                    <div className="mt-3 pt-3 border-t border-silver-100 grid grid-cols-2 gap-2">
                      <Link
                        href={`/admin/batches/${batch.id}`}
                        className="rounded-xl bg-navy-700 px-3 py-2 text-center text-sm font-bold text-white hover:bg-navy-800"
                      >
                        View Students
                      </Link>
                      <Link
                        href={`/admin/attendance?batchId=${batch.id}`}
                        className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-center text-sm font-bold text-navy-700 hover:border-teal-500"
                      >
                        Attendance
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="text-[15px] font-extrabold text-navy-700">Quick Links</p>
          <div className="mt-3 grid gap-2">
            <Link href="/" className="rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-navy-800">View Website</Link>
            <Link href="/admin/tests" className="rounded-xl border border-silver-300 px-4 py-2.5 text-center text-sm font-bold text-navy-700 hover:border-teal-500">Test Engine (shared)</Link>
          </div>
        </div>
        {dbLive && selectedBatch ? (
          <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card md:col-span-2 lg:col-span-3">
            <p className="flex items-center gap-2 text-[15px] font-extrabold text-navy-700">
              <PenSquare className="h-4 w-4 text-teal-600" /> Offline Marks Entry — {selectedBatch.name}
            </p>
            <p className="mt-1 text-[13px] text-muted">Only your assigned batches and OFFLINE tests are listed. Percentage is computed server-side.</p>
            <div className="mt-3">
              <OfflineMarksForm />
            </div>
          </div>
        ) : dbLive ? (
          <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card md:col-span-2 lg:col-span-3">
            <p className="flex items-center gap-2 text-[15px] font-extrabold text-navy-700">
              <PenSquare className="h-4 w-4 text-teal-600" /> Offline Marks Entry
            </p>
            <p className="mt-1 text-[13px] text-muted">Select a batch above to manage offline marks for that batch.</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
