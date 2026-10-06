"use client";

import { cn } from "@/lib/utils";
import type { TestStatus } from "@/lib/testTypes";

const TONES: Record<TestStatus, string> = {
  draft: "bg-silver-50 text-muted border-silver-200",
  scheduled: "bg-navy-50 text-navy-700 border-silver-200",
  published: "bg-teal-50 text-teal-700 border-teal-100",
  live: "bg-teal-500 text-white border-teal-500",
  completed: "bg-crimson-50 text-crimson border-crimson-100",
  archived: "bg-silver-50 text-muted border-silver-200",
};

export function TestStatusBadge({ status }: { status: TestStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize", TONES[status])}>
      {status === "live" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> : null}
      {status}
    </span>
  );
}
