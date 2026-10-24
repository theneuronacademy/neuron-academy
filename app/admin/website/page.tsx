"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Presentation, Home, Megaphone, GalleryHorizontal, Images, Star, Trophy, Bell, Globe, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingState } from "@/components/admin/AdminStates";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { getWebsiteStatus } from "@/services/adminApi";

const SECTIONS = [
  { href: "/admin/website/courses", label: "Courses", desc: "5 tracks • admission flags", icon: BookOpen },
  { href: "/admin/website/faculty", label: "Faculty Page", desc: "4 public profiles", icon: Presentation },
  { href: "/admin/website/banners", label: "Banners", desc: "Promotional carousel", icon: Home },
  { href: "/admin/website/popups", label: "Popups", desc: "Demo / scholarship offers", icon: Megaphone },
  { href: "/admin/website/gallery", label: "Gallery", desc: "Photos & videos — admin-managed", icon: GalleryHorizontal },
  { href: "/admin/website/about-media", label: "About Media", desc: "About images • layout + motion", icon: Images },
  { href: "/admin/website/testimonials", label: "Testimonials", desc: "4 demo quotes", icon: Star },
  { href: "/admin/website/results", label: "Web Results", desc: "4 demo selections", icon: Trophy },
  { href: "/admin/website/announcements", label: "Announcements", desc: "Top running banner", icon: Bell },
];

export default function WebsiteOverviewPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [site, setSite] = useState<{ online: boolean; lastUpdate: string; activeBanners: number; activePopups: number } | null>(null);

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    (async () => {
      try {
        setSite(await getWebsiteStatus());
      } catch {
        setSite(null);
      } finally {
        setReady(true);
      }
    })();
  }, [router, authReady, isAdmin]);

  if (!ready) {
    return (
      <AdminLayout title="Website" subtitle="Public site control">
        <LoadingState message="Loading website status…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Website" subtitle="Control every public section without touching code">
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-silver-200 bg-white p-4 shadow-card">
        <AdminStatusBadge tone={site?.online ? "green" : "red"}>{site?.online ? "Website online" : "Website offline"}</AdminStatusBadge>
        <span className="text-[13px] font-semibold text-muted">Last content update: {site?.lastUpdate}</span>
        <span className="text-[13px] font-semibold text-muted">• {site?.activeBanners} active banners • {site?.activePopups} active popup</span>
        <a href="/" target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-navy-700 px-4 py-2 text-[13px] font-bold text-white hover:bg-navy-800">
          <Globe className="h-4 w-4" /> View live site
        </a>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-card border border-silver-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
            <span className="inline-flex rounded-xl bg-navy-700 p-2.5 text-white">
              <s.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[15px] font-extrabold text-navy-700">{s.label}</p>
            <p className="mt-0.5 text-[12px] font-semibold text-muted">{s.desc}</p>
            <p className="mt-2 flex items-center gap-1 text-[12px] font-bold text-teal-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Manage →
            </p>
          </Link>
        ))}
      </div>
    </AdminLayout>
  );
}
