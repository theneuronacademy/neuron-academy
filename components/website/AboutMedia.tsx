"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SmartImage } from "@/lib/siteImages";
import { bannerAnimationClass } from "@/components/website/bannerMotion";

export interface AboutMediaRow {
  id: string;
  imageUrl: string;
  caption?: string;
  altText?: string;
}

type AboutMediaLayout = "grid" | "carousel" | "rotate";

const ROTATE_INTERVAL_MS = 4500;

/**
 * Public display for the "About the Academy" media collection.
 * Grid shows every image; carousel/rotate show one at a time (rotate steps
 * automatically unless the visitor prefers reduced motion or is hovering).
 * Purely presentational — data comes from app/page.tsx (live rows + settings).
 */
export function AboutMediaDisplay({
  rows,
  layout = "grid",
  animation = "none",
  badge,
}: {
  rows: AboutMediaRow[];
  layout?: AboutMediaLayout;
  animation?: string;
  badge?: React.ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [motionReduced, setMotionReduced] = useState(false);
  const touchX = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const paged = layout === "carousel" || layout === "rotate";
  const safe = Math.min(idx, Math.max(0, rows.length - 1));
  const animClass = animation && animation !== "none" ? bannerAnimationClass(animation) : "";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (layout !== "rotate" || rows.length <= 1 || motionReduced || paused) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % rows.length), ROTATE_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [layout, rows.length, motionReduced, paused]);

  const altFor = (r: AboutMediaRow, i: number) =>
    r.altText || r.caption || `About the Academy photo ${i + 1}`;

  const caption = (r: AboutMediaRow) =>
    r.caption?.trim() ? (
      <p className="mt-2 text-[12px] font-semibold text-muted">{r.caption}</p>
    ) : null;

  if (rows.length === 0) return null;
  const activeRow = rows[safe];

  const go = (dir: -1 | 1) => setIdx((i) => (i + dir + rows.length) % rows.length);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
  };

  return (
    <div ref={stageRef} className={animClass}>
      {paged ? (
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="relative min-h-[360px] overflow-hidden rounded-2xl border border-silver-200 bg-white shadow-card">
            <SmartImage
              key={activeRow.id}
              src={activeRow.imageUrl}
              alt={altFor(activeRow, safe)}
              className="absolute inset-0 h-full w-full"
              imgClassName="h-full w-full object-cover transition duration-700 hover:scale-105"
              fallback={
                <div className="bg-metallic-dark absolute inset-0 overflow-hidden p-8">
                  <p className="relative text-[11px] font-bold tracking-[0.2em] text-brand-secondary-300">ABOUT NEURON ACADEMY</p>
                  <p className="relative mt-3 text-2xl font-extrabold text-white">A clear path to focused preparation</p>
                </div>
              }
            />
            {rows.length > 1 ? (
              <>
                <button
                  onClick={() => go(-1)}
                  aria-label="Previous About photo"
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-navy-950/70 text-white backdrop-blur transition hover:bg-navy-950"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => go(1)}
                  aria-label="Next About photo"
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-navy-950/70 text-white backdrop-blur transition hover:bg-navy-950"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {rows.map((r, i) => (
                    <button
                      key={r.id}
                      onClick={() => setIdx(i)}
                      aria-label={`Show About photo ${i + 1}`}
                      aria-pressed={i === safe}
                      className={`h-2 w-2 rounded-full transition ${i === safe ? "bg-white" : "bg-white/45"}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
            {badge}
          </div>
          {caption(activeRow)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {rows.map((r, i) => (
            <div key={r.id} className="overflow-hidden rounded-2xl border border-silver-200 bg-white shadow-card">
              <div className="relative min-h-[200px]">
                <SmartImage
                  src={r.imageUrl}
                  alt={altFor(r, i)}
                  className="absolute inset-0 h-full w-full"
                  imgClassName="h-full w-full object-cover transition duration-700 hover:scale-105"
                  fallback={
                    <div className="bg-metallic-dark absolute inset-0 overflow-hidden p-6">
                      <p className="relative text-[11px] font-bold tracking-[0.2em] text-brand-secondary-300">ABOUT NEURON ACADEMY</p>
                    </div>
                  }
                />
              </div>
              {caption(r)}
            </div>
          ))}
          {badge ? <div className="relative mt-2 h-[84px]">{badge}</div> : null}
        </div>
      )}
    </div>
  );
}
