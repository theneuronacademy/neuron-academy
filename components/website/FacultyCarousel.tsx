"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FacultyCard } from "@/components/website/FacultyCard";
import type { FacultyMember } from "@/data/faculty";

/** Horizontally scrollable faculty strip — native touch swipe on phones,
 * arrow controls and snap scrolling on desktop. */
export function FacultyCarousel({ members }: { members: FacultyMember[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector("article");
    const step = (card ? card.clientWidth + 20 : 320) * dir;
    el.scrollBy({ left: step, behavior: "smooth" });
  };

  return (
    <div className="relative mt-10">
      <div className="mb-3 flex justify-end gap-2">
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Scroll faculty left"
          className="rounded-full border border-silver-300 bg-white p-2.5 text-navy-800 shadow-card transition hover:border-brand-primary/40 hover:text-brand-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => scrollBy(1)}
          aria-label="Scroll faculty right"
          className="rounded-full border border-silver-300 bg-white p-2.5 text-navy-800 shadow-card transition hover:border-brand-primary/40 hover:text-brand-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={trackRef}
        className="portal-nav-scroll -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6"
      >
        {members.map((f, i) => (
          <div key={f.id} className="w-[275px] shrink-0 snap-start sm:w-[300px]">
            <FacultyCard f={f} delay={i % 4} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] font-bold tracking-widest text-muted sm:hidden">SWIPE TO SEE MORE FACULTY</p>
    </div>
  );
}
