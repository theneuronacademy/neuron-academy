"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export const LOGO_SRC = "/images/logo.png";

/**
 * Academy logo. Drop the real logo file at public/images/logo.png
 * (transparent PNG ~400px wide works best; the circular badge crops
 * cleanly with rounded-full). Until then the text emblem shows.
 */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className={cn("flex items-center justify-center rounded-full bg-navy-700 text-white shadow-card ring-2 ring-white", className)}
        style={{ width: size, height: size }}
      >
        <GraduationCap style={{ width: size * 0.55, height: size * 0.55 }} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="Neuron Academy — Shaheen Bagh"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn("rounded-full object-cover shadow-card ring-2 ring-white", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <a href="#home" className="group flex items-center gap-2.5" aria-label="Neuron Academy home">
      <span className="transition duration-300 group-hover:rotate-6 group-hover:scale-105">
        <LogoMark size={compact ? 34 : 42} />
      </span>
      <span className="leading-none">
        <span className={cn("block font-extrabold tracking-tight", compact ? "text-sm" : "text-[15px]", dark ? "text-white" : "text-navy-700")}>
          NEURON ACADEMY
        </span>
        <span className="block text-[9px] font-bold tracking-[0.24em] text-teal-500">
          SHAHEEN BAGH • NEW DELHI
        </span>
      </span>
    </a>
  );
}
