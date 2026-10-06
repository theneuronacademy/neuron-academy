"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "teal",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent?: "teal" | "navy" | "crimson";
}) {
  const iconTone =
    accent === "teal"
      ? "bg-teal-50 text-teal-600"
      : accent === "crimson"
        ? "bg-crimson-50 text-crimson"
        : "bg-navy-50 text-navy-700";
  return (
    <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card transition hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-muted">{label.toUpperCase()}</p>
          <p className="mt-1 text-[28px] font-extrabold leading-none text-navy-700">{value}</p>
          {sub ? <p className="mt-1.5 text-[12px] font-semibold text-muted">{sub}</p> : null}
        </div>
        <span className={cn("rounded-xl p-2.5", iconTone)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}
