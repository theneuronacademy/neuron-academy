"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, FileText, CalendarCheck, Bell, LogOut, User, BarChart3, Layers } from "lucide-react";
import { Logo } from "@/components/website/Logo";
import { cn } from "@/lib/utils";

const FACULTY_ITEMS = [
  { href: "/faculty/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/faculty/batches", label: "My Batches", icon: Layers },
  { href: "/faculty/students", label: "Students", icon: Users },
  { href: "/faculty/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/faculty/tests", label: "Tests", icon: FileText },
  { href: "/faculty/results", label: "Results", icon: BarChart3 },
  { href: "/faculty/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/faculty/notifications", label: "Notifications", icon: Bell },
];

export function FacultyShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = React.useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/notifications/mine", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (live && res.ok && json?.success === true && typeof json.data?.unreadCount === "number") {
          setUnread(json.data.unreadCount);
        }
      } catch {
        /* offline — no badge */
      }
    })();
    return () => {
      live = false;
    };
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-silver-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Faculty navigation">
            {FACULTY_ITEMS.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={cn("relative rounded-lg px-3 py-2 text-sm font-bold", pathname.startsWith(it.href) ? "bg-navy-50 text-navy-700" : "text-muted hover:text-navy-700")}
              >
                {it.label}
                {it.href === "/faculty/notifications" && unread > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-crimson px-1 text-[10px] font-extrabold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </Link>
            ))}
            <Link
              href="/faculty/profile"
              aria-label="My profile"
              className={cn("rounded-lg p-2", pathname.startsWith("/faculty/profile") ? "bg-navy-50 text-navy-700" : "text-muted hover:text-navy-700")}
            >
              <User className="h-5 w-5" />
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden rounded-xl px-3 py-2 text-sm font-bold text-muted hover:text-navy-700 sm:block">Website</Link>
            <button
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } catch {
                  /* ignore */
                }
                router.push("/faculty/login");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-silver-300 px-3.5 py-2 text-sm font-bold text-navy-700 hover:border-crimson hover:text-crimson"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-silver-100 px-4 py-2 sm:hidden" aria-label="Faculty mobile">
          {FACULTY_ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn("relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-bold", pathname.startsWith(it.href) ? "bg-navy-700 text-white" : "text-muted")}
            >
              <it.icon className="h-3.5 w-3.5" />{it.label}
              {it.href === "/faculty/notifications" && unread > 0 ? (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson px-1 text-[10px] font-extrabold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
          ))}
          <Link
            href="/faculty/profile"
            aria-label="My profile"
            className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-bold", pathname.startsWith("/faculty/profile") ? "bg-navy-700 text-white" : "text-muted")}
          >
            <User className="h-3.5 w-3.5" />Profile
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-xl font-extrabold tracking-tight text-navy-700">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13px] font-semibold text-muted">{subtitle}</p> : null}
        <div className="mt-4">{children}</div>
      </main>
    </div>
  );
}
