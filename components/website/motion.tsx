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
  variant?: "up" | "fade" | "left" | "right" | "zoom" | "pop";
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
    pop: "scale-50 -rotate-2 opacity-0",
  };

  return (
    <div
      ref={ref}
      className={cn("transition-all duration-700 ease-out will-change-transform", visible ? "translate-x-0 translate-y-0 scale-100 rotate-0 opacity-100" : hidden[variant], className)}
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

/** Typewriter — cycles phrases with a blinking caret. Purely decorative. */
export function Typewriter({
  phrases,
  className,
  speed = 55,
  pause = 1700,
}: {
  phrases: string[];
  className?: string;
  speed?: number;
  pause?: number;
}) {
  const [text, setText] = useState("");
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduceMotion || phrases.length === 0) {
      setText(phrases[0] ?? "");
      return;
    }
    let phrase = 0;
    let char = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = phrases[phrase % phrases.length];
      if (!deleting) {
        char += 1;
        setText(full.slice(0, char));
        if (char >= full.length) {
          deleting = true;
          timer = setTimeout(tick, pause);
          return;
        }
        timer = setTimeout(tick, speed);
      } else {
        char -= 1;
        setText(full.slice(0, char));
        if (char <= 0) {
          deleting = false;
          phrase += 1;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, speed / 2);
      }
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [phrases, speed, pause, reduceMotion]);

  return (
    <span className={className}>
      {text}
      <span className="typewriter-caret" aria-hidden>
        |
      </span>
    </span>
  );
}

/** Floating emoji layer — gentle rising emojis behind a section. Decorative. */
export function FloatingEmojis({
  emojis = ["🧠", "⚡", "✨", "🎯", "📚"],
  count = 8,
  className,
}: {
  emojis?: string[];
  count?: number;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShow(true);
  }, []);
  if (!show) return null;
  const spots = Array.from({ length: count }, (_, i) => ({
    left: `${(i * 97 + 13) % 100}%`,
    bottom: `${(i * 53 + 7) % 60}%`,
    size: 18 + ((i * 29) % 22),
    delay: `${(i * 1.37) % 7}s`,
    emoji: emojis[i % emojis.length],
  }));
  return (
    <div className={cn("emoji-float-layer pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {spots.map((s, i) => (
        <span
          key={i}
          className="animate-emoji-drift absolute"
          style={{ left: s.left, bottom: s.bottom, fontSize: s.size, animationDelay: s.delay }}
        >
          {s.emoji}
        </span>
      ))}
    </div>
  );
}

/** Tilt — subtle 3D follow-the-mouse tilt for cards. Decorative. */
export function Tilt({ children, className, max = 9 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${px * max}deg) rotateX(${-py * max}deg) translateY(-4px)`;
  };
  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "rotateY(0deg) rotateX(0deg)";
  };
  return (
    <div className={cn("tilt-scene", className)}>
      <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className="tilt-card h-full">
        {children}
      </div>
    </div>
  );
}

/** ConfettiBurst — emoji confetti explosion on click. Decorative. */
const BURST_PIECES = ["🎉", "✨", "🧠", "⚡", "🏆", "🎯", "⭐", "🚀"];
export function ConfettiBurst({ children, className }: { children: React.ReactNode; className?: string }) {
  const [bursts, setBursts] = useState<number[]>([]);
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fire = () => {
    if (reduceMotion) return;
    const id = Date.now() + Math.random();
    setBursts((b) => [...b.slice(-2), id]);
    setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 1000);
  };
  return (
    <span onClick={fire} className={cn("confetti-launcher relative inline-flex", className)}>
      {children}
      {bursts.map((id) => (
        <span key={id} className="pointer-events-none absolute left-1/2 top-1/2 z-20" aria-hidden>
          {BURST_PIECES.map((e, i) => {
            const angle = (i / BURST_PIECES.length) * Math.PI * 2 + Math.random() * 0.5;
            const dist = 70 + Math.random() * 70;
            return (
              <span
                key={i}
                className="confetti-piece absolute text-xl"
                style={{ "--dx": `${Math.cos(angle) * dist}px`, "--dy": `${Math.sin(angle) * dist - 40}px` } as React.CSSProperties}
              >
                {e}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

/** MouseGlow — soft spotlight that follows the cursor. Desktop only, decorative. */
export function MouseGlow({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setOn(true);
  }, []);
  if (!on) return null;
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.parentElement?.getBoundingClientRect();
        if (!r) return;
        el.style.transform = `translate(${e.clientX - r.left - 150}px, ${e.clientY - r.top - 150}px)`;
      }}
    >
      <div
        ref={ref}
        className="h-[300px] w-[300px] rounded-full opacity-60 blur-3xl transition-transform duration-200 ease-out"
        style={{ background: "radial-gradient(circle, rgba(26,166,181,0.35) 0%, rgba(212,175,55,0.18) 45%, transparent 70%)" }}
      />
    </div>
  );
}
