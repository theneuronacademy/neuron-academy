"use client";

import { Instagram, Youtube, Facebook, Linkedin, MessageCircle, Send } from "lucide-react";
import { SOCIAL_LINKS } from "@/data/social";

const ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
  facebook: <Facebook className="h-4 w-4" />,
  telegram: <Send className="h-4 w-4" />,
  linkedin: <Linkedin className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
};

export function SocialSidebar() {
  return (
    <>
      {/* Desktop: fixed right vertical pill */}
      <div className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 md:block">
        <div className="metallic-dark flex flex-col overflow-hidden rounded-l-2xl border border-r-0 border-silver-300/30 py-1 shadow-card">
          {SOCIAL_LINKS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              aria-label={s.label}
              className="group flex items-center justify-end gap-0 px-3 py-2.5 text-silver-200 transition-all hover:bg-white/10 hover:text-white hover:pr-4"
            >
              <span className="max-w-0 overflow-hidden whitespace-nowrap text-[12px] font-bold opacity-0 transition-all group-hover:ml-2 group-hover:max-w-[100px] group-hover:opacity-100">
                {s.label}
              </span>
              <span className="ml-2">{ICONS[s.icon]}</span>
            </a>
          ))}
        </div>
      </div>
      {/* Mobile: compact horizontal bottom-right */}
      <div className="fixed bottom-4 right-4 z-40 flex gap-2 md:hidden">
        {SOCIAL_LINKS.slice(0, 3).map((s) => (
          <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} className="rounded-full bg-navy-700 p-3 text-white shadow-card">
            {ICONS[s.icon]}
          </a>
        ))}
      </div>
    </>
  );
}
