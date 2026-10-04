"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

// TODO auth: protect via middleware + server session later.
// Pages additionally guard with lib/adminAuth (demo) until then.

export function AdminLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden lg:block">
        <div className="sticky top-0 h-screen w-64">
          <AdminSidebar />
        </div>
      </aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-800/60" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72">
            <AdminSidebar mobile onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <AdminHeader title={title} subtitle={subtitle} onMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
