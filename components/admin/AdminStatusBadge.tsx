"use client";

import { cn } from "@/lib/utils";

export type StatusTone = "green" | "blue" | "amber" | "red" | "gray";

const TONES: Record<StatusTone, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blue: "bg-teal-50 text-teal-700 border-teal-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-crimson-50 text-crimson-DEFAULT border-crimson-100",
  gray: "bg-silver-50 text-muted border-silver-200",
};

export function AdminStatusBadge({ tone = "gray", children }: { tone?: StatusTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", TONES[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function statusToneFor(status: string): StatusTone {
  const s = status.toLowerCase();
  if (["active", "published", "live", "sent", "converted"].includes(s)) return "green";
  if (["scheduled", "contacted", "upcoming"].includes(s)) return "blue";
  if (["new", "draft", "pending"].includes(s)) return "amber";
  if (["inactive", "closed", "expired"].includes(s)) return "gray";
  if (["completed"].includes(s)) return "blue";
  return "gray";
}
