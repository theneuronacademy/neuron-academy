"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  LogOut,
  FileText,
  Database,
  BarChart3,
  Users,
  GraduationCap,
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
  Star,
  Trophy,
  User,
  Lock,
} from "lucide-react";
import { adminLogout } from "@/lib/adminAuth";
import { Logo } from "@/components/website/Logo";
import { cn } from "@/lib/utils";

// TODO auth: wrap admin routes with real session check (middleware + server session).
// Demo guard lives in each page via lib/adminAuth until backend auth lands.

const GROUPS: { label: string; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Main",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Website",
    items: [
      { href: "/admin/website", label: "Website Overview", icon: Globe },
      { href: "/admin/website/courses", label: "Courses", icon: BookOpen },
      { href: "/admin/website/faculty", label: "Faculty Page", icon: Presentation },
      { href: "/admin/website/banners", label: "Banners", icon: Home },
      { href: "/admin/website/popups", label: "Popups", icon: Megaphone },
      { href: "/admin/website/gallery", label: "Gallery", icon: GalleryHorizontal },
      { href: "/admin/website/testimonials", label: "Testimonials", icon: Star },
      { href: "/admin/website/results", label: "Web Results", icon: Trophy },
      { href: "/admin/website/announcements", label: "Announcements", icon: Bell },
      { href: "/admin/advertisements", label: "Advertisements", icon: ImageIcon },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/students", label: "Students", icon: Users },
      { href: "/admin/faculty", label: "Faculty", icon: GraduationCap },
      { href: "/admin/batches", label: "Batches", icon: Layers },
    ],
  },
  {
    label: "Academic",
    items: [
      { href: "/admin/tests", label: "Tests", icon: FileText },
      { href: "/admin/test-access", label: "Test Access", icon: Lock },
      { href: "/admin/question-bank", label: "Question Bank", icon: Database },
      { href: "/admin/books", label: "Books", icon: BookOpen },
      { href: "/admin/results", label: "Results", icon: BarChart3 },
      { href: "/admin/attendance", label: "Attendance", icon: BarChart3 },
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
    label: "System",
    items: [
      { href: "/admin/profile", label: "Profile", icon: User },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AdminSidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className={cn("flex h-full flex-col bg-navy-800 text-silver-200", mobile ? "w-full" : "w-64")}>
      <div className="border-b border-white/10 bg-white px-4 py-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label="Admin">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1.5 text-[10px] font-bold tracking-[0.18em] text-silver-300/70">{g.label.toUpperCase()}</p>
            <div className="space-y-1">
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
          </div>
        ))}
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
