"use client";

import { useEffect, useState } from "react";
import { X, ArrowRight, Zap } from "lucide-react";
import { getAnnouncementAds } from "@/lib/mockStore";
import { DEFAULT_ANNOUNCEMENT } from "@/lib/websiteData";

const ROTATING = [
  DEFAULT_ANNOUNCEMENT.text,
  "JEE + NEET Batches — Book Your Free Demo Class",
  "AMU & Jamia Entrance Special Batches — Limited Seats",
  "Weekly Mock Tests With Ranks Every Saturday",
];

/** Slim live announcement bar — rotates messages, admin announcements win. */
export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  const [tick, setTick] = useState(0);
  const [admin, setAdmin] = useState<{ text: string; ctaText: string; ctaLink: string } | null>(null);

  useEffect(() => {
    const load = () => {
      const ads = getAnnouncementAds();
      if (ads.length > 0) {
        const top = ads[0];
        setAdmin({
          text: top.title + (top.subtitle ? ` | ${top.subtitle}` : ""),
          ctaText: top.ctaText || DEFAULT_ANNOUNCEMENT.ctaText,
          ctaLink: top.ctaLink || DEFAULT_ANNOUNCEMENT.ctaLink,
        });
      } else setAdmin(null);
    };
    load();
    window.addEventListener("neuron-ads-updated", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("neuron-ads-updated", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  useEffect(() => {
    if (admin) return;
    const t = setInterval(() => setTick((x) => x + 1), 4000);
    return () => clearInterval(t);
  }, [admin]);

  if (dismissed) return null;
  const text = admin ? admin.text : ROTATING[tick % ROTATING.length];
  const ctaText = admin ? admin.ctaText : DEFAULT_ANNOUNCEMENT.ctaText;
  const ctaLink = admin ? admin.ctaLink : DEFAULT_ANNOUNCEMENT.ctaLink;

  return (
    <div className="relative z-[60] flex items-center justify-center gap-3 overflow-hidden bg-gradient-to-r from-navy-950 via-navy-800 to-navy-950 px-4 py-2 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-35" style={{ backgroundImage: "radial-gradient(circle at 10% 50%, rgba(212,175,55,.45) 0, transparent 30%), radial-gradient(circle at 90% 50%, rgba(23,70,184,.45) 0, transparent 30%)" }} aria-hidden />
      <p key={text} className="animate-fade-in relative truncate text-[12px] font-bold tracking-wide text-white">
        <Zap className="mr-1.5 inline h-3.5 w-3.5 text-brand-secondary-300" />
        {text}
      </p>
      <a href={ctaLink} className="relative hidden items-center gap-1 rounded-full bg-brand-secondary px-3 py-1 text-[11px] font-extrabold text-navy-950 transition hover:bg-brand-secondary-300 sm:inline-flex">
        {ctaText} <ArrowRight className="h-3 w-3" />
      </a>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="absolute right-3 rounded-md p-1 text-silver-300 hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
