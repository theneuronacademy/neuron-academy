"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  LogOut,
  Users,
  Layers,
  Megaphone,
  Image as ImageIcon,
  Bell,
  Inbox,
  Settings,
  Home,
  BookOpen,
  Presentation,
  GalleryHorizontal,
  Images,
  Star,
  Trophy,
  User,
  Library,
  ChevronDown,
  ClipboardList,
  HelpCircle,
  CalendarCheck,
  KeyRound,
} from "lucide-react";
import { adminLogout } from "@/lib/adminAuth";
import { Logo } from "@/components/website/Logo";
import { cn } from "@/lib/utils";

// Admin routes are protected by edge middleware (middleware.ts) + server session;
// page-level lib/adminAuth guards remain as a client-side fallback.

// Every legitimate admin function is listed exactly once; destinations are
// untouched (only added where a page existed without a sidebar entry).
const GROUPS: { label: string; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Website Content",
    items: [
      { href: "/admin/website", label: "Website Overview", icon: Globe },
      { href: "/admin/website/homepage", label: "Homepage Content", icon: Home },
      { href: "/admin/website/about-media", label: "About Media", icon: Images },
      { href: "/admin/website/banners", label: "Banners", icon: Home },
      { href: "/admin/advertisements", label: "Advertisements", icon: ImageIcon },
      { href: "/admin/website/gallery", label: "Gallery", icon: GalleryHorizontal },
      { href: "/admin/website/popups", label: "Popups", icon: Megaphone },
      { href: "/admin/website/testimonials", label: "Testimonials", icon: Star },
      { href: "/admin/website/results", label: "Web Results", icon: Trophy },
      { href: "/admin/website/announcements", label: "Announcements", icon: Bell },
      { href: "/admin/website/courses", label: "Course Visibility", icon: BookOpen },
      { href: "/admin/website/faculty", label: "Public Faculty", icon: Presentation },
    ],
  },
  {
    label: "Academy Management",
    items: [
      { href: "/admin/tests", label: "Tests", icon: ClipboardList },
      { href: "/admin/results", label: "Results", icon: Trophy },
      { href: "/admin/question-bank", label: "Question Bank", icon: HelpCircle },
      { href: "/admin/timetable", label: "Timetable", icon: CalendarCheck },
      { href: "/admin/test-access", label: "Test Access", icon: KeyRound },
      { href: "/admin/batches", label: "Batches", icon: Layers },
    ],
  },
  {
    label: "Books & Study Material",
    items: [
      { href: "/admin/books", label: "Books", icon: BookOpen },
      { href: "/admin/materials", label: "Study Material", icon: Library },
    ],
  },
  {
    label: "Students & Faculty",
    items: [
      { href: "/admin/students", label: "Students", icon: Users },
      { href: "/admin/faculty", label: "Faculty", icon: User },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/profile", label: "Profile", icon: User },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AdminSidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <div className={cn("flex h-full flex-col bg-navy-800 text-silver-200", mobile ? "w-full" : "w-64")}>
      <div className="border-b border-white/10 bg-white px-4 py-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-2 overflow-y-auto p-3" aria-label="Admin">
        {GROUPS.map((g) => {
          const isCollapsed = collapsed[g.label] === true;
          const groupActive = g.items.some((it) => pathname === it.href || (it.href !== "/admin/dashboard" && pathname.startsWith(it.href + "/")));
          return (
            <div key={g.label} className="rounded-xl bg-white/[0.04] px-1 py-1">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [g.label]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between px-2.5 py-2 text-[10px] font-bold tracking-[0.18em] text-silver-300/90 uppercase hover:text-white"
              >
                <span className="flex items-center gap-1.5">
                  {groupActive ? <span className="h-1.5 w-1.5 rounded-full bg-teal-400" aria-hidden /> : null}
                  {g.label}
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", isCollapsed && "-rotate-90")} />
              </button>
              {!isCollapsed ? (
                <div className="space-y-1 px-1 pb-1">
                  {g.items.map((it) => {
                    const active = pathname === it.href || (it.href !== "/admin/dashboard" && pathname.startsWith(it.href + "/"));
                    const exactDashboard = it.href === "/admin/dashboard" && pathname === "/admin/dashboard";
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3.5 py-2 text-[13px] font-bold transition",
                          active || exactDashboard ? "bg-teal-500 text-white" : "hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <it.icon className="h-4 w-4 shrink-0" /> {it.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-[13px] font-bold hover:bg-white/10 hover:text-white"
        >
          <Globe className="h-4 w-4" /> View Website
        </a>
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => {
            // Phase 4: clear server session (no-op in demo mode) + demo flag.
            try {
              void fetch("/api/auth/logout", { method: "POST" });
            } catch {
              /* demo mode */
            }
            adminLogout();
            router.push("/admin/login");
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-crimson-100 hover:bg-crimson hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </div>
  );
}
