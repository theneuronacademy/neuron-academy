"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { isAdminAuthenticated, DEMO_ADMIN } from "@/lib/adminAuth";

export default function AdminProfilePage() {
  const router = useRouter();
  useEffect(() => {
    if (!isAdminAuthenticated()) router.replace("/admin/login");
  }, [router]);

  return (
    <AdminLayout title="Profile" subtitle="Admin account (demo)">
      <div className="max-w-lg rounded-card border border-silver-200 bg-white p-6 shadow-card">
        <p className="text-lg font-extrabold text-navy-700">Academy Admin</p>
        <p className="mt-1 text-sm text-muted">Demo profile — connect to real admin API later.</p>
        <div className="mt-4 space-y-2 text-sm">
          <p><span className="font-bold text-navy-700">Email:</span> {DEMO_ADMIN.email}</p>
          <p><span className="font-bold text-navy-700">Admin ID:</span> {DEMO_ADMIN.adminId}</p>
        </div>
      </div>
    </AdminLayout>
  );
}
