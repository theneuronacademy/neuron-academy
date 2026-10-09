"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { TESTIMONIALS } from "@/data/testimonials";
import type { Testimonial } from "@/data/testimonials";
import { cn } from "@/lib/utils";

/** Auto-rotating student testimonials with manual controls. Accepts live
 * CMS rows; falls back to the curated static set when none are provided. */
export function Testimonials({ items = TESTIMONIALS }: { items?: Testimonial[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [paused, items.length]);

  if (items.length === 0) {
    return <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No testimonials yet.</p>;
  }
  const cur = items[i % items.length];

  return (
    <div
      className="relative overflow-hidden rounded-card-lg border border-silver-200 bg-white p-6 shadow-card sm:p-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Quote className="absolute -top-2 left-6 h-20 w-20 text-teal-500/10" aria-hidden />
      <div key={cur.id} className="animate-fade-in relative">
        <div className="flex items-center gap-1 text-amber-400" aria-label="5 out of 5 stars">
          {[0, 1, 2, 3, 4].map((s) => <Star key={s} className="h-4 w-4 fill-current" />)}
        </div>
        <blockquote className="mt-4 max-w-3xl text-[17px] font-medium leading-relaxed text-ink sm:text-lg">
          “{cur.testimonial}”
        </blockquote>
        <div className="mt-5 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-navy-700 to-teal-600 text-lg font-extrabold text-white">
            {cur.studentName.charAt(0)}
          </span>
          <div>
            <p className="text-sm font-extrabold text-navy-700">{cur.studentName}</p>
            <p className="text-[12px] font-bold text-muted">{cur.course} • {cur.achievement}</p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          {items.map((t, j) => (
            <button key={t.id} onClick={() => setI(j)} aria-label={`Show testimonial ${j + 1}`} className={cn("h-2 rounded-full transition-all", j === i ? "w-8 bg-teal-500" : "w-2 bg-silver-300 hover:bg-silver-400")} />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setI((i - 1 + items.length) % items.length)} aria-label="Previous testimonial" className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setI((i + 1) % items.length)} aria-label="Next testimonial" className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
