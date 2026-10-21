"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, FileText, CalendarCheck, Bell, LogOut, User, BarChart3, Layers, CalendarDays, HelpCircle, BookOpen, ClipboardList, Award, MessageSquare } from "lucide-react";
import { Logo } from "@/components/website/Logo";
import { LangToggle, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const FACULTY_ITEMS = [
  { href: "/faculty/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/faculty/batches", labelKey: "batches", icon: Layers },
  { href: "/faculty/students", labelKey: "students", icon: Users },
  { href: "/faculty/attendance", labelKey: "attendance", icon: CalendarCheck },
  { href: "/faculty/tests", labelKey: "tests", icon: FileText },
  { href: "/faculty/results", labelKey: "results", icon: BarChart3 },
  { href: "/faculty/analytics", labelKey: "analytics", icon: BarChart3 },
  { href: "/faculty/timetable", labelKey: "timetable", icon: CalendarDays },
  { href: "/faculty/materials", labelKey: "materials", icon: BookOpen },
  { href: "/faculty/assignments", labelKey: "assignments", icon: ClipboardList },
  { href: "/faculty/gradebook", labelKey: "gradebook", icon: Award },
  { href: "/faculty/doubts", labelKey: "doubts", icon: HelpCircle },
  { href: "/faculty/notifications", labelKey: "notifications", icon: Bell },
  { href: "/faculty/parents", labelKey: "parents", icon: MessageSquare },
] as const;

export function FacultyShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <FacultyInner title={title} subtitle={subtitle}>{children}</FacultyInner>;
}

function FacultyInner({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { t } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = React.useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/notifications/mine?limit=1", { cache: "no-store" });
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
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Logo compact />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <LangToggle />
            <Link href="/" className="hidden rounded-xl px-3 py-2 text-sm font-bold text-muted hover:text-navy-700 sm:block">Website</Link>
            <button
              aria-label="Logout"
              title="Logout"
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } catch {
                  /* ignore */
                }
                router.push("/faculty/login");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-silver-300 px-2.5 py-2 text-sm font-bold text-navy-700 hover:border-crimson hover:text-crimson sm:px-3.5"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
        <nav className="portal-nav-scroll mx-auto flex max-w-7xl gap-1 overflow-x-auto border-t border-silver-100 px-4 py-2 sm:px-6" aria-label="Faculty navigation">
          {FACULTY_ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn("relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-bold", pathname.startsWith(it.href) ? "bg-navy-50 text-navy-700" : "text-muted hover:bg-silver-50 hover:text-navy-700")}
            >
              <it.icon className="h-3.5 w-3.5" />{t(it.labelKey)}
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
            className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-bold", pathname.startsWith("/faculty/profile") ? "bg-navy-50 text-navy-700" : "text-muted hover:bg-silver-50 hover:text-navy-700")}
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
