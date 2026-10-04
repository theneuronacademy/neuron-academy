"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Scroll-reveal wrapper — fades/slides children in when they enter view. */
export function Reveal({
  children,
  delay = 0,
  variant = "up",
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  variant?: "up" | "fade" | "left" | "right" | "zoom";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const hidden: Record<string, string> = {
    up: "translate-y-8 opacity-0",
    fade: "opacity-0",
    left: "-translate-x-8 opacity-0",
    right: "translate-x-8 opacity-0",
    zoom: "scale-95 opacity-0",
  };

  return (
    <div
      ref={ref}
      className={cn("transition-all duration-700 ease-out will-change-transform", visible ? "translate-x-0 translate-y-0 scale-100 opacity-100" : hidden[variant], className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Animated count-up number that starts when scrolled into view. */
export function Counter({
  value,
  suffix = "",
  duration = 1600,
  className,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const step = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setN(Math.round(value * eased));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {n.toLocaleString("en-IN")}{suffix}
    </span>
  );
}

/** Infinite scrolling ticker tape. */
export function Marquee({ items, className, itemClassName }: { items: string[]; className?: string; itemClassName?: string }) {
  const row = [...items, ...items];
  return (
    <div className={cn("marquee overflow-hidden", className)} aria-hidden>
      <div className="marquee-track flex w-max items-center gap-8 pr-8">
        {row.map((t, i) => (
          <span key={i} className={cn("flex items-center gap-8 whitespace-nowrap text-sm font-extrabold tracking-wide", itemClassName)}>
            {t} <span className="text-teal-300">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
