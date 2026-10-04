"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, LogOut, Bell } from "lucide-react";
import { Logo } from "@/components/website/Logo";
import { studentLogout } from "@/lib/studentAuth";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/tests", label: "Tests", icon: FileText },
  { href: "/student/notifications", label: "Notifications", icon: Bell },
];

export function StudentShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-silver-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Student">
            {ITEMS.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={cn("rounded-lg px-3 py-2 text-sm font-bold", pathname.startsWith(it.href) ? "bg-navy-50 text-navy-700" : "text-muted hover:text-navy-700")}
              >
                {it.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden rounded-xl px-3 py-2 text-sm font-bold text-muted hover:text-navy-700 sm:block">Website</Link>
            <button
              onClick={() => {
                studentLogout();
                router.push("/student/login");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-silver-300 px-3.5 py-2 text-sm font-bold text-navy-700 hover:border-crimson-DEFAULT hover:text-crimson-DEFAULT"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-silver-100 px-4 py-2 sm:hidden" aria-label="Student mobile">
          {ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-bold", pathname.startsWith(it.href) ? "bg-navy-700 text-white" : "text-muted")}
            >
              <it.icon className="h-3.5 w-3.5" />{it.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-xl font-extrabold tracking-tight text-navy-700">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13px] font-semibold text-muted">{subtitle}</p> : null}
        <div className="mt-4">{children}</div>
      </main>
    </div>
  );
}
