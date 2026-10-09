"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingState } from "@/components/admin/AdminStates";
import { isAdminAuthenticated } from "@/lib/adminAuth";

/** Phase 17 — admin identity comes from the server session, never demo constants. */
export default function AdminProfilePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) router.replace("/admin/login");
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const u = json?.data?.user;
        if (res.ok && u?.role === "ADMIN") {
          setMe({ name: String(u.name ?? "Academy Admin"), email: String(u.email ?? "—"), role: "ADMIN" });
        }
      } catch {
        /* stays signed-out view below */
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <AdminLayout title="Profile" subtitle="Admin account">
        <LoadingState message="Loading profile…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Profile" subtitle="Admin account">
      <div className="max-w-lg rounded-card border border-silver-200 bg-white p-6 shadow-card">
        <p className="text-lg font-extrabold text-navy-700">{me?.name ?? "Signed out"}</p>
        <p className="mt-1 text-sm text-muted">
          {me ? "Authenticated via server session." : "No active admin session. Sign in again."}
        </p>
        <div className="mt-4 space-y-2 text-sm">
          <p><span className="font-bold text-navy-700">Email:</span> {me?.email ?? "—"}</p>
          <p><span className="font-bold text-navy-700">Role:</span> {me?.role ?? "—"}</p>
        </div>
      </div>
    </AdminLayout>
  );
}
