"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Layers, LogOut, PenSquare } from "lucide-react";
import { OfflineMarksForm } from "@/components/admin/OfflineMarksForm";
import { isDbLive } from "@/services/dbLive";

/**
 * Faculty dashboard — Phase 4 BASIC shell only (not the full faculty module).
 * Guarded by the server session (middleware) + this client check.
 * Assigned batches / students / marks / attendance land in Phase 5.
 */
export default function FacultyDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [dbLive, setDbLive] = useState(false);

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
      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="flex items-center gap-2 text-[15px] font-extrabold text-navy-700">
            <Layers className="h-4 w-4 text-teal-600" /> Assigned Batches
          </p>
          <p className="mt-2 text-[13px] text-muted">Batch assignment, student lists, marks entry and attendance arrive in Phase 5 (faculty module).</p>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="text-[15px] font-extrabold text-navy-700">Quick Links</p>
          <div className="mt-3 grid gap-2">
            <Link href="/" className="rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-navy-800">View Website</Link>
            <Link href="/admin/tests" className="rounded-xl border border-silver-300 px-4 py-2.5 text-center text-sm font-bold text-navy-700 hover:border-teal-500">Test Engine (shared)</Link>
          </div>
        </div>
        {dbLive ? (
          <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card md:col-span-2">
            <p className="flex items-center gap-2 text-[15px] font-extrabold text-navy-700">
              <PenSquare className="h-4 w-4 text-teal-600" /> Offline Marks Entry
            </p>
            <p className="mt-1 text-[13px] text-muted">Only your assigned batches and OFFLINE tests are listed. Percentage is computed server-side.</p>
            <div className="mt-3">
              <OfflineMarksForm />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
