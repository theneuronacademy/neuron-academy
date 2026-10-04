"use client";

import { Menu, Globe } from "lucide-react";

export function AdminHeader({ title, subtitle, onMenu }: { title: string; subtitle?: string; onMenu: () => void }) {
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-silver-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onMenu} aria-label="Open admin menu" className="rounded-lg p-2 text-navy-700 hover:bg-silver-100 lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold text-navy-700">{title}</h1>
          <p className="truncate text-[12px] font-semibold text-muted">
            {subtitle ?? today} {subtitle ? <span aria-hidden> • </span> : null}
            {subtitle ? today : null}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-2 rounded-full border border-silver-200 bg-silver-50 px-3 py-1.5 text-[12px] font-bold text-navy-700 sm:inline-flex">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-700 text-[11px] font-extrabold text-white">A</span>
          Admin
        </span>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-navy-700 px-4 py-2 text-[13px] font-bold text-white hover:bg-navy-800"
        >
          <Globe className="h-4 w-4" /> <span className="hidden sm:inline">View Website</span>
          <span className="sm:hidden">Site</span>
        </a>
      </div>
    </div>
  );
}
