"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Faq as FaqItem } from "@/data/faq";

/** Accessible FAQ accordion (keyboard + ARIA). */
export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);

  if (items.length === 0) {
    return <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">FAQs will be updated soon.</p>;
  }

  return (
    <div className="space-y-2.5">
      {items.map((f) => {
        const isOpen = open === f.id;
        return (
          <div key={f.id} className={cn("overflow-hidden rounded-card border bg-white transition", isOpen ? "border-teal-500/50 shadow-card" : "border-silver-200")}>
            <button
              onClick={() => setOpen(isOpen ? null : f.id)}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${f.id}`}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <span className="text-[14.5px] font-extrabold text-navy-700">{f.question}</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-teal-600 transition-transform duration-300", isOpen && "rotate-180")} />
            </button>
            <div id={`faq-panel-${f.id}`} hidden={!isOpen}>
              <p className="animate-fade-in px-4 pb-4 text-sm leading-relaxed text-muted">{f.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
