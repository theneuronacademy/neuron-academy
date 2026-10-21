"use client";

import { useState } from "react";
import Link from "next/link";
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
    <Link href="/#home" className="group flex min-w-0 items-center gap-2.5" aria-label="Activate your neurons at Neuron Academy. NEET, JEE, JMI, AMU and other Olympiads.">
      <span className="transition duration-300 group-hover:rotate-6 group-hover:scale-105">
        <LogoMark size={compact ? 38 : 48} />
      </span>
      <span className="min-w-0 leading-none">
        <span className={cn("block whitespace-nowrap text-[7px] font-extrabold tracking-[0.12em] sm:text-[8px]", dark ? "text-brand-secondary-300" : "text-brand-primary")}>
          ACTIVATE YOUR NEURONS AT
        </span>
        <span className={cn("block whitespace-nowrap font-extrabold tracking-tight", compact ? "text-sm" : "text-[15px] sm:text-base", dark ? "text-white" : "text-navy-950")}>
          NEURON ACADEMY
        </span>
        <span className={cn("mt-0.5 block whitespace-nowrap text-[6px] font-bold tracking-[0.1em] sm:text-[7px]", dark ? "text-silver-200" : "text-brand-secondary-700")}>
          NEET • JEE • JMI • AMU • OTHER OLYMPIADS
        </span>
      </span>
    </Link>
  );
}
