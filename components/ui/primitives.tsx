import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base =
    "btn-metallic-sheen inline-flex items-center justify-center gap-2 font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<Variant, string> = {
    primary: "bg-crimson text-white hover:bg-crimson-bright rounded-xl shadow-card",
    secondary: "bg-teal-500 text-white hover:bg-teal-400 rounded-xl shadow-card",
    outline: "border border-silver-300 bg-white text-navy-700 hover:border-teal-500 hover:text-teal-600 rounded-xl",
    ghost: "text-navy-700 hover:bg-silver-100 rounded-xl",
    danger: "bg-red-600 text-white hover:bg-red-700 rounded-xl",
  };
  const sizes: Record<Size, string> = {
    sm: "px-3 py-2 text-[13px]",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-[15px]",
  };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function StatusBadge({ tone = "teal", children }: { tone?: "teal" | "navy" | "red" | "silver"; children: React.ReactNode }) {
  const tones = {
    teal: "bg-teal-50 text-teal-700 border-teal-100",
    navy: "bg-navy-50 text-navy-700 border-silver-200",
    red: "bg-crimson-50 text-crimson border-crimson-100",
    silver: "bg-silver-50 text-muted border-silver-200",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide", tones[tone])}>
      {children}
    </span>
  );
}

export function MetallicCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("metallic-surface rounded-card shadow-card", className)}>
      {children}
    </div>
  );
}

export function SectionHeader({ eyebrow, title, desc, dark = false }: { eyebrow: string; title: string; desc?: string; dark?: boolean }) {
  return (
    <div className="max-w-2xl">
      <p className={cn("eyebrow-line text-[11px] font-bold tracking-[0.22em]", dark ? "text-teal-300" : "text-teal-600")}>{eyebrow}</p>
      <h2 className={cn("mt-3 text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-[40px]", dark ? "text-white" : "text-navy-700")}>{title}</h2>
      <div className="metallic-gold-line mt-4 w-24 opacity-80" aria-hidden />
      {desc ? <p className={cn("mt-3 text-[15px] leading-relaxed", dark ? "text-silver-200" : "text-muted")}>{desc}</p> : null}
    </div>
  );
}

export function ProgressBar({ value, tone = "teal", className }: { value: number; tone?: "teal" | "navy" | "red"; className?: string }) {
  const colors = { teal: "bg-teal-500", navy: "bg-navy-700", red: "bg-crimson" };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-silver-200", className)}>
      <div className={cn("h-full rounded-full transition-all", colors[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
