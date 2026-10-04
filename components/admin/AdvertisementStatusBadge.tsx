"use client";

import type { Advertisement } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AdvertisementStatusBadge({ ad, today }: { ad: Advertisement; today: string }) {
  const expired = ad.endDate < today;
  const scheduled = ad.startDate > today;
  let label = ad.isActive ? "Active" : "Inactive";
  let cls = ad.isActive ? "bg-teal-50 text-teal-700 border-teal-100" : "bg-silver-50 text-muted border-silver-200";
  if (scheduled) {
    label = "Scheduled";
    cls = "bg-navy-50 text-navy-700 border-silver-200";
  } else if (expired) {
    label = "Expired";
    cls = "bg-crimson-50 text-crimson-DEFAULT border-crimson-100";
  }
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold", cls)}>
      {label}
    </span>
  );
}
